'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const Config = app.model.define('config', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        name: STRING(30),
        value: STRING(5000)
    });

    Config.getAll = async function () {
        return await this.findAll({

            attributes: ['name', 'value']
        })
    }

    return Config;
}