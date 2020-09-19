'use strict';

const Controller = require('./base');

class OtherController extends Controller {

    /**
     * 找一找 - 总关数
     */
    async searchCount() {
        const { app } = this
        const count = await app.model.SearchConfig.count()
        return this.success({ count })
    }

    /**
     * 找一找 - 关详情
     */
    async searchInfo() {
        const { app, ctx } = this
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },
        })
        const { id } = ctx.request.body
        const info = await app.model.SearchConfig.findOne({
            where: {
                id
            },
            attributes: ['title', 'value']
        })
        if (info.value) {
            info.value = JSON.parse(info.value)
        }
        return this.success(info)
    }

    /**
     * 拼拼乐 - 总关数
     */
    async spellCount() {
        const { app } = this
        const count = await app.model.SpellConfig.count()
        return this.success({ count })
    }

    /**
     * 拼拼乐 - 关详情
     */
    async spellInfo() {
        const { app, ctx } = this
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },
        })
        const { id } = ctx.request.body
        const info = await app.model.SpellConfig.findOne({
            where: {
                id
            },
            attributes: ['title', 'value', 'image']
        })
        if (info.value) {
            info.value = JSON.parse(info.value)
        }
        return this.success(info)
    }
}

module.exports = OtherController;
