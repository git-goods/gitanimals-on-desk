"use strict";

(async function bootstrapSettings() {
  const [{ ReactDOM, h }, { App }] = await Promise.all([
    import("./ui-dist/react.js"),
    import("./ui-dist/App.js"),
  ]);

  const rootElement = document.getElementById("root");
  const root = ReactDOM.createRoot
    ? ReactDOM.createRoot(rootElement)
    : { render: (node) => ReactDOM.render(node, rootElement) };

  root.render(h(App));
})().catch((err) => {
  console.error("Settings renderer failed to boot:", err);
});
