# api
项目主要目录如下
/app 应用
/app/controller 控制器
/app/controller/chat.js websocket消息处理控制器
/app/extend 类库
/app/model 模型，对应数据库表
/app/schedule 定时器 主要用于团队匹配
/app/service 服务 游戏逻辑代码
/app/router.js 路由定义 
/app/middleware 中间件 分别为，用户检权中间件，异常收集处理中间件

/config 配置文件 线上环境 创建 /config/env 文件 文件内容为环境名 当下生产环境为prod, 于是env文件中写入 prod 就可以了
app.js 主要用于延时队列，延时发送消息至客户端
package.json 第三方包管理 无需理会
其他目录可以忽略

### Development

```bash
$ npm i
$ npm run dev
$ open http://localhost:7001/
```

### Deploy

```bash
$ npm start
$ npm stop
```
