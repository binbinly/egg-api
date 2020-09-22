"use strict";

const Service = require("egg").Service;

/**
 * redis快捷操作
 */
class CacheService extends Service {

    /**
     * 设置redis缓存
     * @param {string} key 键
     * @param {string | object | array} value 值
     * @param {Number} expir 过期时间
     * @return {String} 返回成功字符串OK
     */
    async set(key, value, expir = 0) {
        const { redis } = this.app;
        if (expir === 0) {
            return await redis.set(key, JSON.stringify(value));
        } else {
            return await redis.set(key, JSON.stringify(value), "EX", expir);
        }
    }

    async get(key) {
        const { redis } = this.app;
        const result = await redis.get(key);
        return JSON.parse(result);
    }

    async exist(key){
        const { redis } = this.app;
        return await redis.exists(key);
    }

    async incr(key, number = 1) {
        const { redis } = this.app;
        if (number === 1) {
            return await redis.incr(key);
        } else {
            return await redis.incrby(key, number);
        }
    }

    async strlen(key) {
        const { redis } = this.app;
        return await redis.strlen(key);
    }

    async remove(key) {
        const { redis } = this.app;
        return await redis.del(key);
    }

    async clear() {
        return await this.app.redis.flushall();
    }

    async inGame(user_id, major_id){
        const {redis} = this.app;
        return await redis.sadd('game_major_'+major_id, user_id);
    }

}

module.exports = CacheService;
