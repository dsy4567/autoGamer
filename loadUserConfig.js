//@ts-check

const fs = require("fs");
const path = require("path");

/**
 * 加载用户自定义配置文件，不存在则自动创建空配置
 * @param {string} userConfigPath 用户配置文件的绝对路径
 * @param {string} [description="用户自定义配置"] 描述，写入自动创建文件的注释
 * @returns {object} 用户配置对象
 */
function loadUserConfig(userConfigPath, description = "用户自定义配置") {
    if (!fs.existsSync(userConfigPath)) {
        fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
        fs.writeFileSync(
            userConfigPath,
            `// ${description}\nmodule.exports = {};\n`,
        );
    }

    return require(userConfigPath);
}

module.exports = loadUserConfig;
