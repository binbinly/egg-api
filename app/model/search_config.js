'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const SearchConfig = app.model.define('search_config', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        title: STRING(30),
        value: STRING(5000)
    });

    return SearchConfig;
}