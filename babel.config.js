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
      "react-native-reanimated/plugin"
    ]
  };
};
