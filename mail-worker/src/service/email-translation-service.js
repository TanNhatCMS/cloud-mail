import translationConst from '../const/translation-const';
import translationRepository from '../repository/translation-repository';
import translationHtmlUtils from '../utils/translation-html-utils';
import translationPrompt from '../utils/translation-prompt';
import aiService from './ai-service';
import emailUtils from '../utils/email-utils';
import BizError from '../error/biz-error';
import { getT } from '../i18n/i18n';
import KvConst from '../const/kv-const';

const STATE = translationConst.STATE;

function randomId() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text) {
	const data = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

const translationService = {

	resolveLang(c, lang) {
		const target = String(lang || '').toLowerCase();
		if (target === 'zh' || target === 'zh-cn' || target === 'zh-hans') return 'zh';
		if (target === 'en' || target === 'en-us' || target === 'en-gb') return 'en';
		throw new BizError(getT(c)('translationLanguageUnsupported'), 400, 'translationLanguageUnsupported');
	},

	async readableEmail(c, emailId, userId) {
		const row = await c.env.db.prepare(`
			SELECT e.email_id, e.content, e.text, e.account_id
			FROM email e
			INNER JOIN account a ON a.account_id = e.account_id
			WHERE e.email_id = ? AND e.user_id = ? AND e.is_del = 0 AND a.is_del = 0
		`).bind(emailId, userId).first();
		if (!row) {
			throw new BizError(getT(c)('translationNotFound'), 404, 'translationNotFound');
		}
		return row;
	},

	modelOf(c) {
		return c.env.ai_translate_model || c.env.ai_model || translationConst.MODEL;
	},

	byteLength(text) {
		return new TextEncoder().encode(String(text || '')).length;
	},

	async buildPlan(c, row, lang) {
		const content = row.content || '';
		const text = row.text || '';
		const htmlMode = !!content.trim() && this.byteLength(content) <= translationConst.MAX_HTML_BYTES;
		const format = htmlMode ? translationConst.FORMAT.HTML : translationConst.FORMAT.TEXT;
		const sourceBody = htmlMode ? content : text;

		if (!String(sourceBody || '').trim()) {
			throw new BizError(getT(c)('translationEmpty'), 400, 'translationEmpty');
		}

		try {
			return await this.buildPlanInner(c, content, text, format, sourceBody);
		} catch (e) {
			if (e?.message === 'TRANSLATION_TOO_LARGE') {
				throw new BizError(getT(c)('translationTooLarge'), 413, 'translationTooLarge');
			}
			throw e;
		}
	},

	async buildPlanInner(c, content, text, format, sourceBody) {
		if (format === translationConst.FORMAT.HTML) {
			const document = translationHtmlUtils.parse(sourceBody);
			translationHtmlUtils.sanitize(document);
			const units = translationHtmlUtils.extractUnits(document);
			if (units.length === 0) {
				const plain = emailUtils.htmlToText(sourceBody);
				if (!plain) throw new BizError(getT(c)('translationEmpty'), 400, 'translationEmpty');
				// 降级到纯文本时同样要查字符上限，否则这条路径能绕过全文限制
				if (Array.from(plain).length > translationConst.MAX_TEXT_CODEPOINTS) {
					throw new BizError(getT(c)('translationTooLarge'), 413, 'translationTooLarge');
				}
				const plainUnits = translationHtmlUtils.extractPlainUnits(plain);
				return {
					format: translationConst.FORMAT.TEXT,
					fallbackSource: true,
					document: null,
					units: plainUnits,
					chunks: translationHtmlUtils.buildPlainChunks(plainUnits),
					plain,
					sourceHash: await sha256('text:' + plain)
				};
			}
			const chunks = translationHtmlUtils.buildChunks(units);
			const codepoints = translationHtmlUtils.countSourceCodepoints(units);
			if (codepoints > translationConst.MAX_TEXT_CODEPOINTS) {
				throw new BizError(getT(c)('translationTooLarge'), 413, 'translationTooLarge');
			}
			return {
				format: translationConst.FORMAT.HTML,
				fallbackSource: false,
				document,
				units,
				chunks,
				plain: '',
				sourceHash: await sha256('html:' + content)
			};
		}

		const plainUnits = translationHtmlUtils.extractPlainUnits(text);
		if (plainUnits.length === 0) {
			throw new BizError(getT(c)('translationEmpty'), 400, 'translationEmpty');
		}
		const plainChunks = translationHtmlUtils.buildPlainChunks(plainUnits);
		const codepoints = plainUnits.reduce((sum, unit) => sum + Array.from(unit.text).length, 0);
		if (codepoints > translationConst.MAX_TEXT_CODEPOINTS) {
			throw new BizError(getT(c)('translationTooLarge'), 413, 'translationTooLarge');
		}
		return {
			format: translationConst.FORMAT.TEXT,
			fallbackSource: false,
			document: null,
			units: plainUnits,
			chunks: plainChunks,
			plain: text,
			sourceHash: await sha256('text:' + text)
		};
	},

	cacheKey(userId, emailId, plan, lang, model) {
		return sha256([
			'v1', userId, emailId, plan.sourceHash, lang, model,
			translationPrompt.version, translationConst.PARSER_VERSION, translationConst.SANITIZER_VERSION
		].join('|'));
	},

	kvKey(userId, cacheKey) {
		return KvConst.TRANSLATE_RESULT + userId + ':' + cacheKey;
	},

	async readKv(c, userId, cacheKey) {
		try {
			return await c.env.kv.get(this.kvKey(userId, cacheKey), { type: 'json' });
		} catch (e) {
			return null;
		}
	},

	async writeKv(c, userId, cacheKey, payload) {
		try {
			await c.env.kv.put(this.kvKey(userId, cacheKey), JSON.stringify(payload), {
				expirationTtl: translationConst.KV_TTL
			});
		} catch (e) {
			console.warn('翻译结果写KV失败', e?.message);
		}
	},

	toPayload(job, extra = {}) {
		const done = Number(job?.done_chunks || 0);
		const total = Number(job?.total_chunks || 0);
		const payload = {
			jobId: job?.job_id || '',
			state: job?.state || STATE.PENDING,
			targetLang: job?.target_lang || '',
			sourceHash: job?.source_hash || '',
			progress: { done, total },
			format: job?.format_name || translationConst.FORMAT.HTML,
			content: job?.content || '',
			text: job?.text || '',
			fallback: !!job?.fallback,
			// 前端要靠它区分「额度用尽」和「AI 出错」，只给一句 message 无法本地化
			errorKey: job?.error_key || '',
			cached: false
		};
		return Object.assign(payload, extra);
	},

	async start(c, params, userId) {
		await translationRepository.ensureSchema(c);
		const emailId = Number(params.emailId);
		if (!Number.isInteger(emailId) || emailId <= 0) {
			throw new BizError(getT(c)('translationInvalidParams'), 400, 'translationInvalidParams');
		}
		const lang = this.resolveLang(c, params.targetLang);
		const row = await this.readableEmail(c, emailId, userId);
		const plan = await this.buildPlan(c, row, lang);
		const model = this.modelOf(c);
		const cacheKey = await this.cacheKey(userId, emailId, plan, lang, model);

		const cached = await this.readKv(c, userId, cacheKey);
		if (cached) {
			return Object.assign({}, cached, { state: STATE.DONE, cached: true });
		}

		let existing = await translationRepository.selectJobByCacheKey(c, cacheKey);
		// 过期任务不可复用，否则前端拿着它 step 会直接 404
		if (existing && Number(existing.expire_time || 0) > 0
			&& Number(existing.expire_time) < Date.now()) {
			await translationRepository.deleteJob(c, existing.job_id);
			existing = null;
		}
		// 失败任务不缓存复用：否则用户点「重试」永远拿到同一个 error 任务
		if (existing && existing.state === STATE.ERROR) {
			await translationRepository.deleteJob(c, existing.job_id);
			existing = null;
		}
		// 分块重试次数已耗尽的任务不可复用：否则用户点「重试」会拿到一个永远推进不了的
		// running 任务，必须再点一次才能建新任务
		if (existing && existing.state === STATE.RUNNING) {
			const now = Date.now();
			const claimable = await translationRepository.countClaimable(c, existing.job_id, now);
			const exhausted = await translationRepository.countExhausted(c, existing.job_id, now);
			const inflight = await translationRepository.countInflight(c, existing.job_id, now);
			if (claimable === 0 && exhausted > 0 && inflight === 0) {
				await translationRepository.deleteJob(c, existing.job_id);
				existing = null;
			}
		}
		if (existing) {
			if (existing.state === STATE.DONE) {
				const payload = this.toPayload(existing, { cached: true });
				await this.writeKv(c, userId, cacheKey, this.toPayload(existing));
				return payload;
			}
			await translationRepository.insertChunks(c, existing.job_id, plan.chunks);
			return this.toPayload(existing);
		}

		// 原子占用每分钟名额：计数表 UPSERT，避免 count→insert 之间被并发绕过
		const rateWindow = Math.floor(Date.now() / 60000);
		const rate = await translationRepository.addRate(
			c, userId, rateWindow, translationConst.RATE_NEW_PER_MINUTE
		);
		if (!rate) {
			throw new BizError(getT(c)('translationRateLimited'), 429, 'translationRateLimited');
		}

		const codepoints = plan.units.reduce((sum, unit) => sum + Array.from(unit.text).length, 0);
		const day = today();

		// 先原子预占配额，再建任务：避免“先建任务后扣额度”期间任务已被 step 消费
		const quota = await translationRepository.addQuota(
			c, userId, day, codepoints,
			translationConst.RATE_NEW_PER_DAY, translationConst.DAILY_CODEPOINT_BUDGET
		);
		if (!quota) {
			// 名额已经先占了，配额没抢到就要把它退回去，否则用户白掉一次调用机会
			await translationRepository.releaseRate(c, userId, rateWindow);
			throw new BizError(getT(c)('translationQuotaExceeded'), 429, 'translationQuotaExceeded');
		}

		const job = {
			jobId: randomId(),
			cacheKey,
			userId,
			emailId,
			sourceHash: plan.sourceHash,
			targetLang: lang,
			model,
			promptVersion: translationPrompt.version,
			format: plan.format,
			totalChunks: plan.chunks.length,
			now: Date.now(),
			expireTime: Date.now() + translationConst.JOB_EXPIRE_DAYS * 24 * 60 * 60 * 1000
		};
		let saved = null;
		let insertError = null;
		try {
			saved = await translationRepository.insertJob(c, job);
		} catch (e) {
			insertError = e;
			// 写入可能已提交、只是响应丢失：先确认任务是否真的落库，
			// 落库了就照常复用，绝不重复退配额
			try {
				saved = await translationRepository.selectJobByCacheKey(c, cacheKey);
			} catch (inner) {
				saved = null;
			}
			if (!saved) {
				await translationRepository.releaseQuota(c, userId, day, codepoints);
				await translationRepository.releaseRate(c, userId, rateWindow);
				throw insertError;
			}
		}
		if (!saved) {
			await translationRepository.releaseQuota(c, userId, day, codepoints);
			await translationRepository.releaseRate(c, userId, rateWindow);
			throw new BizError(getT(c)('translationCacheFailed'), 500, 'translationCacheFailed');
		}

		// 并发下 cache_key 唯一约束会让某个请求抢到别人的任务：此时退还额度并复用该任务，
		// 绝不删除不属于自己的任务行
		if (saved.job_id !== job.jobId) {
			await translationRepository.releaseQuota(c, userId, day, codepoints);
			await translationRepository.releaseRate(c, userId, rateWindow);
			// 该任务由并发请求刚刚创建，分块可能还没写入；这里补齐（幂等），
			// 否则 total_chunks=0 会让前端在 busy 分支空转
			await translationRepository.insertChunks(c, saved.job_id, plan.chunks);
			return this.toPayload(saved);
		}

		try {
			await translationRepository.insertChunks(c, saved.job_id, plan.chunks);
		} catch (e) {
			await translationRepository.deleteJob(c, saved.job_id);
			await translationRepository.releaseQuota(c, userId, day, codepoints);
			await translationRepository.releaseRate(c, userId, rateWindow);
			throw e;
		}

		// 任务行已经落库，但回读失败时不能让任务悬在库里：否则配额已被扣、
		// 下次 start 会复用它并免费 step。这里整条回滚。
		let created = null;
		try {
			created = await translationRepository.selectJob(c, saved.job_id, userId);
		} catch (e) {
			created = null;
		}
		if (!created) {
			await translationRepository.deleteJob(c, saved.job_id);
			await translationRepository.releaseQuota(c, userId, day, codepoints);
			await translationRepository.releaseRate(c, userId, rateWindow);
			throw new BizError(getT(c)('translationCacheFailed'), 500, 'translationCacheFailed');
		}
		return this.toPayload(created);
	},

	async loadJob(c, jobId, userId) {
		const job = await translationRepository.selectJob(c, String(jobId || ''), userId);
		if (!job) {
			throw new BizError(getT(c)('translationJobExpired'), 404, 'translationJobExpired');
		}
		if (Number(job.expire_time || 0) > 0 && Number(job.expire_time) < Date.now()) {
			throw new BizError(getT(c)('translationJobExpired'), 404, 'translationJobExpired');
		}
		// 邮件被删除后不再返回已缓存的译文，避免越权读取历史内容
		await this.readableEmail(c, job.email_id, userId);
		return job;
	},

	async status(c, params, userId) {
		await translationRepository.ensureSchema(c);
		const job = await this.loadJob(c, params.jobId, userId);
		return this.toPayload(job);
	},

	async step(c, params, userId) {
		await translationRepository.ensureSchema(c);
		const jobId = String(params.jobId || '');
		const job = await this.loadJob(c, jobId, userId);
		if (job.state === STATE.DONE) {
			return this.toPayload(job, { cached: true });
		}

		const row = await this.readableEmail(c, job.email_id, userId);
		const plan = await this.buildPlan(c, row, job.target_lang);
		if (plan.sourceHash !== job.source_hash) {
			await translationRepository.updateJobState(c, jobId, STATE.ERROR, { error_key: 'translationSourceChanged' });
			throw new BizError(getT(c)('translationSourceChanged'), 409, 'translationSourceChanged');
		}
		if (plan.chunks.length !== Number(job.total_chunks)) {
			await translationRepository.updateJobState(c, jobId, STATE.ERROR, { error_key: 'translationSourceChanged' });
			throw new BizError(getT(c)('translationSourceChanged'), 409, 'translationSourceChanged');
		}

		const owner = randomId();
		const now = Date.now();
		const chunk = await translationRepository.claimChunk(c, jobId, owner, now);

		if (!chunk) {
			const counts = await translationRepository.countChunkState(c, jobId);
			if (counts.total > 0 && counts.unfinished === 0) {
				return await this.finalize(c, job, plan, userId);
			}
			const claimable = await translationRepository.countClaimable(c, jobId, now);
			if (claimable === 0) {
				const exhausted = await translationRepository.countExhausted(c, jobId, now);
				if (exhausted > 0) {
					await translationRepository.updateJobState(c, jobId, STATE.ERROR, {
						error_key: 'translationModelFailed'
					});
					throw new BizError(getT(c)('translationModelFailed'), 502, 'translationModelFailed');
				}
				if (counts.total === 0) {
					await translationRepository.updateJobState(c, jobId, STATE.ERROR, {
						error_key: 'translationModelFailed'
					});
					throw new BizError(getT(c)('translationModelFailed'), 502, 'translationModelFailed');
				}
				// 其余分块正被并发请求持有：让前端稍后再次 step，而不是判失败
				return this.toPayload(Object.assign({}, job, {
					state: STATE.RUNNING,
					done_chunks: counts.done
				}), { busy: true });
			}
			await translationRepository.updateJobState(c, jobId, STATE.RUNNING);
			return this.toPayload(Object.assign({}, job, { state: STATE.RUNNING, done_chunks: counts.done }));
		}

		await translationRepository.updateJobState(c, jobId, STATE.RUNNING);
		const items = plan.chunks[Number(chunk.chunk_index)] || [];

		try {
			// 用任务上固化的模型名，避免部署期间切换模型导致结果写入错误的缓存键
			const result = await aiService.translateBatch(c, job.target_lang, items, { model: job.model });
			const json = JSON.stringify(Array.from(result.map.entries()));
			const ok = await translationRepository.finishChunk(
				c, chunk.id, owner, json, translationConst.CHUNK_STATUS.DONE
			);
			if (!ok) {
				throw new BizError(getT(c)('translationModelFailed'), 502, 'translationModelFailed');
			}
		} catch (e) {
			// 超时/网关错误属于“结果未知”，不自动重试（可能已产生模型计费）
			const retryable = e?.uncertain !== true;
			await translationRepository.releaseChunk(c, chunk.id, owner, retryable);
			await translationRepository.updateJobState(c, jobId, STATE.RUNNING, { error_key: e?.errorKey || 'translationModelFailed' });
			throw e;
		}

		const counts = await translationRepository.countChunkState(c, jobId);
		await translationRepository.updateProgress(c, jobId, counts.done, counts.total);

		if (counts.unfinished === 0) {
			const fresh = await translationRepository.selectJob(c, jobId, userId);
			return await this.finalize(c, fresh, plan, userId);
		}

		return this.toPayload(Object.assign({}, job, {
			state: STATE.RUNNING,
			done_chunks: counts.done,
			total_chunks: counts.total
		}));
	},

	async finalize(c, job, plan, userId) {
		const rows = await translationRepository.selectChunks(c, job.job_id);
		const map = new Map();
		for (const row of rows) {
			if (row.status !== translationConst.CHUNK_STATUS.DONE || !row.result_json) continue;
			let entries = [];
			try {
				entries = JSON.parse(row.result_json);
			} catch (e) {
				entries = [];
			}
			for (const [id, text] of entries) {
				map.set(id, text);
			}
		}

		let content = '';
		let text = '';
		let fallback = false;
		let format = plan.format;

		if (plan.format === translationConst.FORMAT.HTML && plan.document) {
			const before = translationHtmlUtils.fingerprint(plan.document);
			translationHtmlUtils.applyTranslations(plan.units, map);
			const after = translationHtmlUtils.fingerprint(plan.document);
			if (before !== after) {
				fallback = true;
			} else {
				content = translationHtmlUtils.serialize(plan.document);
			}
		}

		if (!content) {
			if (plan.format === translationConst.FORMAT.TEXT) {
				text = translationHtmlUtils.applyPlainTranslations(plan.plain, plan.units, map);
			} else {
				text = translationHtmlUtils.toPlainTranslation(plan.units, map);
			}
			if (!text) {
				await translationRepository.updateJobState(c, job.job_id, STATE.ERROR, { error_key: 'translationInvalidOutput' });
				throw new BizError(getT(c)('translationInvalidOutput'), 502, 'translationInvalidOutput');
			}
			format = translationConst.FORMAT.TEXT;
			fallback = true;
		}

		const won = await translationRepository.markDone(c, job.job_id, {
			format_name: format,
			content,
			text,
			fallback: fallback ? 1 : 0
		});

		const fresh = await translationRepository.selectJob(c, job.job_id, userId);
		const payload = this.toPayload(fresh);
		if (won) {
			await this.writeKv(c, userId, job.cache_key, payload);
		}
		return Object.assign({}, payload, { cached: !won });
	}
};

export default translationService;