import { parseHTML } from 'linkedom';
import domainUtils from '../utils/domain-uitls';

const DANGEROUS_TAGS = 'script, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, base, meta, link';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'background', 'poster', 'data'];
// 去除空白和控制字符后判断危险协议
const UNSAFE_URL = /^[\s\u0000-\u001f]*(javascript|vbscript|data:text\/html)/i;

export default function emailHtmlTemplate(html, domain) {

	const { document } = parseHTML(html);
	document.querySelectorAll(DANGEROUS_TAGS).forEach(node => node.remove());
	document.querySelectorAll('*').forEach(node => {
		for (const attr of [...node.attributes]) {
			const name = attr.name.toLowerCase();
			if (name.startsWith('on') || name === 'formaction' || name === 'srcdoc') {
				node.removeAttribute(attr.name);
			} else if (URL_ATTRS.includes(name) && UNSAFE_URL.test(attr.value)) {
				node.removeAttribute(attr.name);
			}
		}
	});
	html = document.toString();
	const nonce = crypto.randomUUID().replace(/-/g, '');
	html = html.replace(/{{domain}}/g, domainUtils.toOssDomain(domain) + '/');
	const safeHtmlJson = JSON.stringify(html).replace(/</g, '\\u003C');

	return `<!DOCTYPE html>
<html lang='en' >
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='Content-Security-Policy' content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src * data: blob:; font-src * data:; media-src *; base-uri 'none'; form-action 'none'">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            background: #FFF;
        }

        .content-box {
        		padding: 15px 10px;
            width: 100%;
            height: 100%;
            overflow: auto; /* 改为 auto 允许滚动 */
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .content-html {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class='content-box'>
        <div id='container' class='content-html'></div>
    </div>

    <script nonce='${nonce}'>

        function renderHTML(html) {
            const container = document.getElementById('container');
            const shadowRoot = container.attachShadow({ mode: 'open' });

            // 提取 <body> 的 style 属性
            const bodyStyleRegex = /<body[^>]*style="([^"]*)"[^>]*>/i;
            const bodyStyleMatch = html.match(bodyStyleRegex);
            const bodyStyle = bodyStyleMatch ? bodyStyleMatch[1] : '';

            // 移除 <body> 标签
            const cleanedHtml = html.replace(/<\\/?body[^>]*>/gi, '');

            // 渲染内容
            shadowRoot.innerHTML = \`
                <style>
                    :host {
                        all: initial;
                        width: 100%;
                        height: 100%;
                        font-family: Inter, -apple-system, BlinkMacSystemFont,
                                    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        font-size: 14px;
                        line-height: 1.5;
                        color: #13181D;
                        word-break: break-word;
                        overflow: auto; /* 添加滚动 */
                    }

                    h1, h2, h3, h4 {
                        font-size: 18px;
                        font-weight: 700;
                    }

                    p {
                        margin: 0;
                    }

                    a {
                        text-decoration: none;
                        color: #0E70DF;
                    }

                    .shadow-content {
                        background: #FFFFFF;
                        width: fit-content;
                        height: fit-content;
                        min-width: 100%;
                    }

                    img:not(table img) {
                        max-width: 100% !important;
                        height: auto !important;
                    }
                </style>
                <div class="shadow-content">
                    \${cleanedHtml}
                </div>
            \`;

            // body 的 style 通过 cssText 应用, 避免注入
            if (bodyStyle) {
                shadowRoot.querySelector('.shadow-content').style.cssText += bodyStyle;
            }

            // 自动缩放
            autoScale(shadowRoot, container);
        }

        function autoScale(shadowRoot, container) {

            if (!shadowRoot || !container) return;

            const parent = container;
            const shadowContent = shadowRoot.querySelector('.shadow-content');

            if (!shadowContent) return;

            const parentWidth = parent.offsetWidth;
            const childWidth = shadowContent.scrollWidth;

            if (childWidth === 0) return;

            const scale = parentWidth / childWidth;

            const hostElement = shadowRoot.host;
            hostElement.style.zoom = scale;
        }

        // 使用示例
        const exampleHtml = ${safeHtmlJson};

        // 渲染HTML
        renderHTML(exampleHtml);
    </script>
</body>
</html>`
}
