import typescriptEslintParser from '@typescript-eslint/parser';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    // 指定需要检查的文件（包括 TypeScript）
    files: ['**/*.ts'],  // 覆盖 .ts 和 .js 文件
    // 使用 TypeScript 解析器
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        sourceType: 'module',  // 对应 package.json 中的 "type": "module"
        project: './tsconfig.json'  // 关联你的 tsconfig.json（可选，用于类型检查）
      }
    },
    // 启用 TypeScript 插件
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin
    },
    // 配置规则（包括之前的双引号规则和 TypeScript 规则）
    rules: {
      // 强制双引号
      quotes: ["error", "double"],
      // TypeScript 基础规则（可选，根据需要添加）
      '@typescript-eslint/no-unused-vars': 'warn',  // 检测未使用的变量
      '@typescript-eslint/explicit-function-return-type': 'off',  // 关闭强制函数返回类型（按需开启）
      indent: ["error", 2, {
        SwitchCase: 1
      }]
    }
  }
];