import { jsx, jsxs } from 'react/jsx-runtime';

// src/react/ChangelogList.tsx
var DEFAULT_LABELS = {
  empty: "No changelog entries."
};
function toRows(data) {
  return data.months.flatMap(
    (monthBlock) => monthBlock.entries.map((entry, index) => ({
      month: monthBlock.month,
      showMonth: index === 0,
      refs: entry.refs,
      refsDisplay: entry.refsDisplay,
      descriptionMd: entry.descriptionMd
    }))
  );
}
function ChangelogList({ data, commitUrl, labels, className }) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const rows = toRows(data);
  if (rows.length === 0) {
    return /* @__PURE__ */ jsx("p", { className, children: copy.empty });
  }
  return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsx("dl", { className: "divide-y divide-zinc-800 border-t border-zinc-800", children: rows.map(({ month, showMonth, refs, refsDisplay, descriptionMd }) => /* @__PURE__ */ jsxs("div", { className: "py-6 sm:grid sm:grid-cols-3 sm:gap-4", children: [
    /* @__PURE__ */ jsx("dt", { className: "text-sm/6 font-medium text-zinc-100", children: showMonth ? month : /* @__PURE__ */ jsx("span", { className: "sr-only", children: month }) }),
    /* @__PURE__ */ jsxs("dd", { className: "mt-1 text-sm/6 text-zinc-300 sm:col-span-2 sm:mt-0", children: [
      /* @__PURE__ */ jsx("div", { className: "space-y-2 text-sm text-zinc-200", children: descriptionMd.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => /* @__PURE__ */ jsx("p", { children: line }, `${refs.join(",")}-${index}`)) }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-emerald-300", children: refsDisplay.map((ref, index) => /* @__PURE__ */ jsxs("span", { children: [
        index > 0 ? ", " : null,
        /* @__PURE__ */ jsx(
          "a",
          {
            href: commitUrl(refs[index] ?? ref),
            target: "_blank",
            rel: "noreferrer",
            className: "underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-300",
            children: `\`${ref}\``
          }
        )
      ] }, `${refs.join(",")}-${ref}`)) })
    ] })
  ] }, `${month}-${refs.join(",")}`)) }) });
}

export { ChangelogList };
//# sourceMappingURL=chunk-6VWL4IDY.js.map
//# sourceMappingURL=chunk-6VWL4IDY.js.map