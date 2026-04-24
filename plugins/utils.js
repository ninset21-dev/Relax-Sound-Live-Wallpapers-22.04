const fs = require("fs");
const path = require("path");

const PKG = "com.relaxsound.livewallpapers";

function pkgToPath(pkg) {
  return pkg.replace(/\./g, "/");
}

function androidMainPath(projectRoot) {
  return path.join(projectRoot, "android", "app", "src", "main");
}

function writeNativeSource(projectRoot, relFile, contents, pkg = PKG) {
  const javaRoot = path.join(androidMainPath(projectRoot), "java", pkgToPath(pkg));
  const fullPath = path.join(javaRoot, relFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
}

function writeResource(projectRoot, relFile, contents) {
  const resRoot = path.join(androidMainPath(projectRoot), "res");
  const fullPath = path.join(resRoot, relFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
}

function writeRaw(projectRoot, relFile, contents) {
  const fullPath = path.join(androidMainPath(projectRoot), relFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
}

module.exports = { PKG, pkgToPath, androidMainPath, writeNativeSource, writeResource, writeRaw };
