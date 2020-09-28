const path = require('path');

module.exports = appInfo => {
    return {
        logger: {
            consoleLevel: 'NONE',
        },
        logrotator: {
            filesRotateBySize: [
                path.join(appInfo.root, 'logs', appInfo.name, 'egg-web.log'),
                path.join(appInfo.root, 'logs', appInfo.name, 'app-web.log'),
                path.join(appInfo.root, 'logs', appInfo.name, 'common-error.log'),
                path.join(appInfo.root, 'logs', appInfo.name, 'egg-agent.log'),
            ],
            maxFileSize: 2 * 1024 * 1024 * 1024,
        },
        // 配置数据库
        sequelize: {
            dialect: 'mysql',
            host: '127.0.0.1',
            username: 'root',
            password: '223125',
            port: 3306,
            database: 'game',
            // 中国时区
            timezone: '+08:00',
            define: {
                // 取消数据表名复数
                freezeTableName: true,
                // 自动写入时间戳 created_at updated_at
                timestamps: true,
                // 字段生成软删除时间戳 deleted_at
                // paranoid: true,
                createdAt: 'created_at',
                updatedAt: false,
                // deletedAt: 'deleted_at',
                // 所有驼峰命名格式化
                underscored: true
            }
        }
    }
};