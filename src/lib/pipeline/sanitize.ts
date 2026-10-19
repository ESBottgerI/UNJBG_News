import sanitizeHtml from "sanitize-html";

export function sanitizeBody(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "b", "i", "em", "strong", "u", "s", "br", "p", "div", "span",
      "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote", "pre", "code", "img", "table", "tr", "td", "th",
      "thead", "tbody"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      "*": ["class"]
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, false)
    }
  });
}

export function cleanText(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
