'use strict';
module.exports = app => {
    const { STRING, INTEGER } = app.Sequelize;

    const Subject = app.model.define('subject', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        title: STRING(500),
        cat_id:{type:INTEGER},
        content:STRING(2000),
        true_option:{type:INTEGER}
    });

    Subject.getAll = async function (cat_id, limit) {
        let list = await this.findAll({
            where:{
                cat_id
            },
            order: app.model.random(),
            attributes: ['id', 'title', 'content', 'true_option'],
            limit
        })
        list.forEach(v => {
            v.content = JSON.parse(v.content)
        });
        return list
    }

    return Subject;
}