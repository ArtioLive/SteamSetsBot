var forever = require('forever-monitor');


console.log('Launching bot');
var bot = new (forever.Monitor)('bot.js');
bot.on('start', function (process, data) {
    console.log('Bot started');
});
bot.on('exit:code', function (code) {
    console.log('Bot stopped with code ' + code);
});
bot.on('stdout', function (data) {
    //console.log(data);
});
bot.start();