// 附件类型由发件人控制, 可执行脚本的类型强制下载, 并用沙箱 CSP 隔离
const SAFE_INLINE_TYPE = /^(image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/plain)\s*(;|$)/i;

const SANDBOX_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";

const objHeaderUtils = {
	safeHeaders(contentType, contentDisposition) {
		contentType = contentType || 'application/octet-stream';
		const inline = SAFE_INLINE_TYPE.test(contentType);
		const headers = {
			'Content-Type': contentType,
			'Content-Disposition': inline ? (contentDisposition || 'inline') : 'attachment',
			'X-Content-Type-Options': 'nosniff'
		};
		// Chrome 不在 sandbox CSP 下渲染 PDF
		if (!/^application\/pdf/i.test(contentType)) {
			headers['Content-Security-Policy'] = SANDBOX_CSP;
		}
		return headers;
	}
};

export default objHeaderUtils;
