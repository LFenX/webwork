// app.jsx — Mount + tweaks (修好的 state 共享).

const {
  Landing,
  TweaksPanel, TweakSection, TweakRadio, TweakToggle,
  useTweaks,
} = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "blue",
  "lightMode": false,
  "italicHeadline": true
}/*EDITMODE-END*/;

// 🐛 修：之前 useTweaks 在两个组件里各自调用，每次 useState 都创建独立 state，
// 所以 panel 改值时 App 看不到变化。这里只调一次，再用 props 传下去。
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const cls = [
    t.accent === "red"   && "accent-red",
    t.accent === "green" && "accent-green",
    t.accent === "warm"  && "accent-warm",
    t.lightMode          && "is-light",
    !t.italicHeadline    && "no-italic",
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} style={{ minHeight: "100%", background: "var(--bg)" }}>
      <Landing/>
      <TweaksPanel>
        <TweakSection label="点缀色" />
        <TweakRadio
          label="Accent"
          value={t.accent}
          options={[
            { value: "blue",  label: "蓝" },
            { value: "red",   label: "红" },
            { value: "green", label: "绿" },
            { value: "warm",  label: "暖" },
          ]}
          onChange={(v) => setTweak("accent", v)}
        />

        <TweakSection label="底色" />
        <TweakToggle
          label="切到浅色 / 暖白"
          value={t.lightMode}
          onChange={(v) => setTweak("lightMode", v)}
        />

        <TweakSection label="标题字体" />
        <TweakToggle
          label="衬线斜体大标题"
          value={t.italicHeadline}
          onChange={(v) => setTweak("italicHeadline", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
