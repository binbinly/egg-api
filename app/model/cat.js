'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const Cat = app.model.define('cat', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        name: STRING(255),
        sort: { type: INTEGER }
    });

    Cat.getAll = async function () {
        return await this.findAll({
            attributes: ['id', 'name'],
            order:[['sort', 'DESC']]
        })
    }

    return Cat;
}