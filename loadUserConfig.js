const fs = require("fs");
const path = require("path");

function loadUserConfig(defaultFile, description = "用户自定义配置") {
    const dir = path.dirname(defaultFile);
    const basename = path.basename(defaultFile);
    const userBasename = basename.replace(".default.js", ".user.js");
    const userFile = path.join(dir, userBasename);

    if (!fs.existsSync(userFile)) {
        fs.writeFileSync(
            userFile,
            `// ${description}，优先于 ${basename}
// 提示：可将 ${basename} 中的配置项复制到此文件按需修改
// 也可直接编辑 ${basename}，但不推荐
module.exports = {};
`,
        );
    }

    return fs.existsSync(userFile) ? require(userFile) : {};
}

module.exports = loadUserConfig;
