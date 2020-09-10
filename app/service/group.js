'use strict';

const Service = require('egg').Service;

class GroupService extends Service {

    /**
     * 
     * @param {int} count 房间人数
     * @param {int} major_id 专业id
     * @param {int} type 类型 1= 强答模式，2 = 出题模式
     */
    async match(count, major_id, type) {
        const {app} = this
        if (count == 1 || count == 2) {
            const len_1 = await app.redis.scard('group_game_match_1_' + major_id + '_' + type)
            const len_2 = await app.redis.scard('group_game_match_2_' + major_id + '_' + type)
            if (len_1 + len_2 >= 6) {
                this.gameStart()
            }
        } else if (count == 3) {
            const len = await app.redis.scard('group_game_match_3_' + major_id + '_' + type)
            if (len >= 2) {
                this.gameStart()
            }
        } else {
            return false
        }
    }

    async gameStart(){

    }

    async gameEnd(){

    }
}

module.exports = GroupService;
