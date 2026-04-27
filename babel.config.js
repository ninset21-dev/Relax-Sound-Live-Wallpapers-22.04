module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            "@app": "./app"
          }
        }
      ],
      // react-native-reanimated/plugin MUST be the LAST babel plugin —
      // expo-router and react-navigation transitively depend on
      // react-native-reanimated, and without this plugin the runtime crashes
      // with "Reanimated 2 failed to create a worklet" before the JS bundle
      // even renders the first screen.
      "react-native-reanimated/plugin"
    ]
  };
};
