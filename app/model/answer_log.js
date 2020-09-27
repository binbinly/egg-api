'use strict';
module.exports = app => {
    const { STRING, INTEGER, DATE } = app.Sequelize;

    const AnswerLog = app.model.define('answer_log', {
        id: { type: INTEGER, primaryKey: true, autoIncrement: true },
        room_name: STRING(255),
        subject_id: { type: INTEGER },
        user_id: { type: INTEGER },
        option_id: { type: INTEGER },
        senond: { type: INTEGER },
        score: { type: INTEGER },
        type: { type: INTEGER },
        status: { type: INTEGER },
        created_at: DATE
    });

    AnswerLog.getAll = async function (user_id, room_name) {
        return await this.findAll({
            attributes: ['user_id', 'subject_id', 'option_id', 'second', 'status'],
            where:{user_id, room_name}
        })
    }

    return AnswerLog;
}