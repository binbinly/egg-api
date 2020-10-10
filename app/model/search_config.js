'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const SearchConfig = app.model.define('search_config', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        title: STRING(30),
        value: STRING(5000)
    });

    // SearchConfig.query=async function({id,major_id}){
    //     const ctx = this.ctx;
    //     return ctx.model.Sys.Role.findAndCountAll({
    //         id,
    //         major_id,
    //         order: [[ 'created_time', 'desc' ]],
    //     });
    //
    // }

    return SearchConfig;
}
