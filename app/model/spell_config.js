'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const SpellConfig = app.model.define('spell_config', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        title: STRING(30),
        image: STRING(255),
        value: STRING(5000)
    });

    return SpellConfig;
}