const chokidar = require('chokidar');
const fse = require('fs-extra');
const path = require('path');

function getDestPath(filePath) {
    return filePath.replace(/src/, 'dist');
}
// 拷贝单个文件（保持目录结构）
function copyFile(filePath) {
    // 计算文件相对于 srcDir 的相对路径（如 src/options/css/style.css → css/style.css）
    const destPath = getDestPath(filePath);
    fse.copySync(filePath, destPath, { overwrite: true });
    console.log(`✅ 同步: ${filePath} → ${destPath}`);
}

// 删除目标文件（当源文件被删除时）
function deleteFile(filePath) {
    const destPath = getDestPath(filePath);
    if (fse.existsSync(destPath)) {
        fse.removeSync(destPath);
        console.log(`🗑️  删除: ${destPath}`);
    }
}

// 初始化监听器
const watcher = chokidar.watch("src", {
    ignored: /(\.DS_Store)|(.*\.ts)/, // 忽略系统隐藏文件
    persistent: true, // 保持监听不退出
    ignoreInitial: false // 初始启动时先全量拷贝一次
});

// 监听事件
watcher
    .on('add', copyFile)      // 新增文件
    .on('change', copyFile)   // 文件修改
    .on('unlink', deleteFile) // 文件删除
    .on('addDir', (dirPath) => {
        // 新增目录时，同步目录结构
        const destDir = getDestPath(dirPath);
        fse.ensureDirSync(destDir);
        console.log(`📂 同步目录: ${dirPath} → ${destDir}`);
    })
    .on('unlinkDir', (dirPath) => {
        // 删除目录时，同步删除目标目录
        const destDir = getDestPath(dirPath);
        fse.removeSync(destDir);
        console.log(`📂 删除目录: ${destDir}`);
    })
    .on('ready', () => {
        console.log(`🚀 开始监听: src`);
        console.log(`🎯 目标目录: dist`);
    })
    .on('error', (err) => {
        console.error(`❌ 监听错误: ${err.message}`);
    });