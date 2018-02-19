let SteamUser = require("steam-user"),
    SteamTotp = require("steam-totp"),
    TradeOfferManager = require("steam-tradeoffer-manager"),
    SteamCommunity = require("steamcommunity"),
    Utils = require("./utils.js"),
    config = require("./SETTINGS/config.js"),
    fs = require('fs'),
    bodyParser = require('body-parser'),
    https = require('https'),
    express = require('express'),
    app = express();

let gamesstockfilename = './games.json',
    giveawayfilename = './giveaway.json',
    jsonfile = require('jsonfile'),
    allCards = {},
    botSets = {},
    users = {},
    userMsgs = {},
    SID64REGEX = new RegExp(/^[0-9]{17}$/),
    chatLogs = "",
    userLogs = {},
    giveawayJSON,
    restock = false,
    totalBotSets = 0,
    options = {
        key: fs.readFileSync('/home/baterka.xyz/ssl.key'),
        cert: fs.readFileSync('/home/baterka.xyz/ssl.cert')
    };

https.createServer(options, app).listen(2083, function () {
    console.log("Express server started...");
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'https://levelup.baterka.xyz');
    res.header('Content-type', 'application/json');
    next();
});

app.post('/rates', function (req, res) {
    let returnJSON = {
        csgo: config.CARDS.CSGO.buy_sets_by_one,
        tf2: config.CARDS.TF2.buy_sets_by_one,
        pubg: config.CARDS.PUBG.buy_sets_by_one,
        gems: config.CARDS.GEMS.buy_one_set_for
    };
    return res.end(JSON.stringify(returnJSON));
});

app.post('/csgobuy', function (req, res) {
    let post = req.body;
    let returnJSON = {
        success: false,
        error: "Unexpected error."
    };
    if (typeof post === 'undefined' || typeof post.keys === 'undefined' || typeof post.steamid === 'undefined' || typeof post.tradelink === 'undefined') {
        console.log(post);
        returnJSON.error = "Bad params.";
        return res.end(JSON.stringify(returnJSON));
    }
    if (botSets) {
        var n = parseInt(post.keys);
        let amountofsets = parseInt(n) * config.CARDS.CSGO.buy_sets_by_one;
        if (!isNaN(n) && parseInt(n) > 0) {
            if (n <= config.MESSAGES.MAXBUY) {
                let t = manager.createOffer(post.tradelink);
                t.getUserDetails((ERR, ME, THEM) => {
                    if (ERR) {
                        console.log("## An error occurred while getting trade holds: " + ERR);
                        returnJSON.error = "An error occurred while getting your trade holds. Please check if your profile and inventory are not private and try again.";
                        return res.end(JSON.stringify(returnJSON));
                    } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                        n = parseInt(n);
                        let theirKeys = [];
                        manager.getUserInventoryContents(post.steamid, config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                            if (ERR) {
                                console.log("## An error occurred while getting inventory: " + ERR);
                                returnJSON.error = "An error occurred while loading your inventory. Please try later";
                                return res.end(JSON.stringify(returnJSON));
                            } else {
                                console.log("DEBUG#INV LOADED");
                                if (!ERR) {
                                    console.log("DEBUG#INV LOADED NOERR");
                                    for (let i = 0; i < INV.length; i++) {
                                        if (theirKeys.length < n && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                            theirKeys.push(INV[i]);
                                        }
                                    }
                                    if (theirKeys.length !== n) {
                                        returnJSON.error = "You do not have enough keys.";
                                        return res.end(JSON.stringify(returnJSON));
                                    } else {
                                        Utils.getBadges(post.steamid, (ERR, DATA) => {
                                            if (!ERR) {
                                                console.log("DEBUG#BADGE LOADED");
                                                if (!ERR) {
                                                    let b = {}; // List with badges that CAN still be crafted
                                                    if (DATA) {
                                                        for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                            if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                            }
                                                        }
                                                    } else {
                                                        returnJSON.error = "Your badges are empty, sending an offer without checking badges.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    console.log(DATA);
                                                    console.log(b);
                                                    // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                    // 1: GET BOTS CARDS. DONE
                                                    // 2: GET PLAYER's BADGES. DONE
                                                    // 3: MAGIC
                                                    let hisMaxSets = 0,
                                                        botNSets = 0;
                                                    // Loop for sets he has partially completed
                                                    for (let i = 0; i < Object.keys(b).length; i++) {
                                                        if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                            hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                        }
                                                    }
                                                    console.log("DEBUG#LOOP 1 DONE");
                                                    // Loop for sets he has never crafted
                                                    for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                        if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                            if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                hisMaxSets += 5;
                                                            } else {
                                                                hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                        }
                                                        botNSets += botSets[Object.keys(botSets)[i]].length;
                                                    }
                                                    console.log("DEBUG#LOOP 2 DONE");
                                                    // HERE
                                                    if (amountofsets <= hisMaxSets) {
                                                        hisMaxSets = amountofsets;
                                                        console.log("DEBUG#TRADE CREATED");
                                                        sortSetsByAmount(botSets, (DATA) => {
                                                            console.log("DEBUG#" + DATA);
                                                            console.log("DEBUG#SETS SORTED");
                                                            firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                if (b[DATA[i]] === 0) {
                                                                    continue firstLoop;
                                                                } else {
                                                                    console.log("DEBUG#" + i);
                                                                    console.log("DEBUG#FOR LOOP ITEMS");
                                                                    if (hisMaxSets > 0) {
                                                                        console.log("DEBUG#MAXSETSMORETHAN1");
                                                                        if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                            // BOT HAS ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1");
                                                                            sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                    console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                    console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #1: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                            // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1 CONTINUE");
                                                                            continue; // *
                                                                        } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                            // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                            bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                        else if (hisMaxSets < 5) {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#RETURN");
                                                                        break firstLoop;
                                                                    }
                                                                }
                                                            }
                                                            if (hisMaxSets > 0) {
                                                                returnJSON.error = "There are not enough sets. Please try again later.";
                                                                return res.end(JSON.stringify(returnJSON));
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addTheirItems(theirKeys);
                                                                t.data("commandused", "Buy");
                                                                t.data("amountofkeys", n);
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        returnJSON.error = "An error occurred while sending your trade. Steam Trades could be down. Please try again later.";
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    } else {
                                                                        returnJSON.error = "Trade sent! Check your Steam!";
                                                                        console.log("## Trade offer sent");
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        returnJSON.error = "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    // TO HERE
                                                } else {
                                                    console.log("An error occurred while getting badges: " + ERR);
                                                }
                                            } else {
                                                returnJSON.error = "An error occurred while getting your badges. Please try again.";
                                                console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                return res.end(JSON.stringify(returnJSON));
                                            }
                                        });
                                    }
                                } else {
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                    returnJSON.error = "An error occurred while loading your inventory, please make sure it's set to public.";
                                    return res.end(JSON.stringify(returnJSON));
                                }
                            }
                        });
                    } else {
                        returnJSON.error = "Please make sure you don't have a trade hold!";
                        return res.end(JSON.stringify(returnJSON));
                    }
                });
            } else {
                returnJSON.error = "Please try a lower amount of keys.";
                return res.end(JSON.stringify(returnJSON));
            }
        } else {
            returnJSON.error = "Please provide a valid amount of keys.";
            return res.end(JSON.stringify(returnJSON));
        }
    } else {
        returnJSON.error = "Please try again later.";
        return res.end(JSON.stringify(returnJSON));
    }
});

app.post('/tf2buy', function (req, res) {
    let post = req.body;
    let returnJSON = {
        success: false,
        error: "Unexpected error."
    };
    if (typeof post === 'undefined' || typeof post.keys === 'undefined' || typeof post.steamid === 'undefined' || typeof post.tradelink === 'undefined') {
        returnJSON.error = "Bad params.";
        return res.end(JSON.stringify(returnJSON));
    }
    if (botSets) {
        var n = parseInt(post.keys);
        let amountofsets = parseInt(n) * config.CARDS.TF2.buy_sets_by_one;
        if (!isNaN(n) && parseInt(n) > 0) {
            if (n <= config.MESSAGES.MAXBUY) {
                let t = manager.createOffer(post.tradelink);
                t.getUserDetails((ERR, ME, THEM) => {
                    if (ERR) {
                        console.log("## An error occurred while getting trade holds: " + ERR);
                        returnJSON.error = "An error occurred while getting your trade holds.  Please check if your profile and inventory are not private and try again.";
                        return res.end(JSON.stringify(returnJSON));
                    } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                        n = parseInt(n);
                        let theirKeys = [];
                        manager.getUserInventoryContents(post.steamid, config.TFGAME, 2, true, (ERR, INV, CURR) => {
                            if (ERR) {
                                console.log("## An error occurred while getting inventory: " + ERR);
                                returnJSON.error = "An error occurred while loading your inventory. Please try later";
                                return res.end(JSON.stringify(returnJSON));
                            } else {
                                console.log("DEBUG#INV LOADED");
                                if (!ERR) {
                                    console.log("DEBUG#INV LOADED NOERR");
                                    for (let i = 0; i < INV.length; i++) {
                                        if (theirKeys.length < n && config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                            theirKeys.push(INV[i]);
                                        }
                                    }
                                    if (theirKeys.length !== n) {
                                        returnJSON.error = "You do not have enough keys.";
                                        return res.end(JSON.stringify(returnJSON));
                                    } else {
                                        Utils.getBadges(post.steamid, (ERR, DATA) => {
                                            if (!ERR) {
                                                console.log("DEBUG#BADGE LOADED");
                                                if (!ERR) {
                                                    let b = {}; // List with badges that CAN still be crafted
                                                    if (DATA) {
                                                        for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                            if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                            }
                                                        }
                                                    } else {
                                                        returnJSON.error = "Your badges are empty, sending an offer without checking badges.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    console.log(DATA);
                                                    console.log(b);
                                                    // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                    // 1: GET BOTS CARDS. DONE
                                                    // 2: GET PLAYER's BADGES. DONE
                                                    // 3: MAGIC
                                                    let hisMaxSets = 0,
                                                        botNSets = 0;
                                                    // Loop for sets he has partially completed
                                                    for (let i = 0; i < Object.keys(b).length; i++) {
                                                        if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                            hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                        }
                                                    }
                                                    console.log("DEBUG#LOOP 1 DONE");
                                                    // Loop for sets he has never crafted
                                                    for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                        if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                            if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                hisMaxSets += 5;
                                                            } else {
                                                                hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                        }
                                                        botNSets += botSets[Object.keys(botSets)[i]].length;
                                                    }
                                                    console.log("DEBUG#LOOP 2 DONE");
                                                    // HERE
                                                    if (amountofsets <= hisMaxSets) {
                                                        hisMaxSets = amountofsets;
                                                        console.log("DEBUG#TRADE CREATED");
                                                        sortSetsByAmount(botSets, (DATA) => {
                                                            console.log("DEBUG#" + DATA);
                                                            console.log("DEBUG#SETS SORTED");
                                                            firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                if (b[DATA[i]] === 0) {
                                                                    continue firstLoop;
                                                                } else {
                                                                    console.log("DEBUG#" + i);
                                                                    console.log("DEBUG#FOR LOOP ITEMS");
                                                                    if (hisMaxSets > 0) {
                                                                        console.log("DEBUG#MAXSETSMORETHAN1");
                                                                        if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                            // BOT HAS ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1");
                                                                            sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                    console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                    console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #1: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                            // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1 CONTINUE");
                                                                            continue; // *
                                                                        } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                            // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                            bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                        else if (hisMaxSets < 5) {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#RETURN");
                                                                        break firstLoop;
                                                                    }
                                                                }
                                                            }
                                                            if (hisMaxSets > 0) {
                                                                returnJSON.error = "There are not enough sets. Please try again later.";
                                                                return res.end(JSON.stringify(returnJSON));
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addTheirItems(theirKeys);
                                                                t.data("commandused", "Buy");
                                                                t.data("amountofkeys", n);
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        returnJSON.error = "An error occurred while sending your trade. Steam Trades could be down. Please try again later.";
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    } else {
                                                                        returnJSON.error = "Trade sent! Check your Steam!";
                                                                        console.log("## Trade offer sent");
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        returnJSON.error = "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    // TO HERE
                                                } else {
                                                    console.log("An error occurred while getting badges: " + ERR);
                                                }
                                            } else {
                                                returnJSON.error = "An error occurred while getting your badges. Please try again.";
                                                console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                return res.end(JSON.stringify(returnJSON));
                                            }
                                        });
                                    }
                                } else {
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                    returnJSON.error = "An error occurred while loading your inventory, please make sure it's set to public.";
                                    return res.end(JSON.stringify(returnJSON));
                                }
                            }
                        });
                    } else {
                        returnJSON.error = "Please make sure you don't have a trade hold!";
                        return res.end(JSON.stringify(returnJSON));
                    }
                });
            } else {
                returnJSON.error = "Please try a lower amount of keys.";
                return res.end(JSON.stringify(returnJSON));
            }
        } else {
            returnJSON.error = "Please provide a valid amount of keys.";
            return res.end(JSON.stringify(returnJSON));
        }
    } else {
        returnJSON.error = "Please try again later.";
        return res.end(JSON.stringify(returnJSON));
    }
});

app.post('/pubgbuy', function (req, res) {
    let post = req.body;
    let returnJSON = {
        success: false,
        error: "Unexpected error."
    };
    if (typeof post === 'undefined' || typeof post.keys === 'undefined' || typeof post.steamid === 'undefined' || typeof post.tradelink === 'undefined') {
        returnJSON.error = "Bad params.";
        return res.end(JSON.stringify(returnJSON));
    }
    if (botSets) {
        var n = parseInt(post.keys);
        let amountofsets = parseInt(n) * config.CARDS.PUBG.buy_sets_by_one;
        if (!isNaN(n) && parseInt(n) > 0) {
            if (n <= config.MESSAGES.MAXBUY) {
                let t = manager.createOffer(post.tradelink);
                t.getUserDetails((ERR, ME, THEM) => {
                    if (ERR) {
                        console.log("## An error occurred while getting trade holds: " + ERR);
                        returnJSON.error = "An error occurred while getting your trade holds. Please check if your profile and inventory are not private and try again.";
                        return res.end(JSON.stringify(returnJSON));
                    } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                        n = parseInt(n);
                        let theirKeys = [];
                        manager.getUserInventoryContents(post.steamid, config.PUBGGAME, 2, true, (ERR, INV, CURR) => {
                            if (ERR) {
                                console.log("## An error occurred while getting inventory: " + ERR);
                                returnJSON.error = "An error occurred while loading your inventory. Please try later";
                                return res.end(JSON.stringify(returnJSON));
                            } else {
                                console.log("DEBUG#INV LOADED");
                                if (!ERR) {
                                    console.log("DEBUG#INV LOADED NOERR");
                                    for (let i = 0; i < INV.length; i++) {
                                        if (theirKeys.length < n && config.PUBGACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                            theirKeys.push(INV[i]);
                                        }
                                    }
                                    if (theirKeys.length !== n) {
                                        returnJSON.error = "You do not have enough keys.";
                                        return res.end(JSON.stringify(returnJSON));
                                    } else {
                                        Utils.getBadges(post.steamid, (ERR, DATA) => {
                                            if (!ERR) {
                                                console.log("DEBUG#BADGE LOADED");
                                                if (!ERR) {
                                                    let b = {}; // List with badges that CAN still be crafted
                                                    if (DATA) {
                                                        for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                            if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                            }
                                                        }
                                                    } else {
                                                        returnJSON.error = "Your badges are empty, sending an offer without checking badges.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    console.log(DATA);
                                                    console.log(b);
                                                    // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                    // 1: GET BOTS CARDS. DONE
                                                    // 2: GET PLAYER's BADGES. DONE
                                                    // 3: MAGIC
                                                    let hisMaxSets = 0,
                                                        botNSets = 0;
                                                    // Loop for sets he has partially completed
                                                    for (let i = 0; i < Object.keys(b).length; i++) {
                                                        if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                            hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                        }
                                                    }
                                                    console.log("DEBUG#LOOP 1 DONE");
                                                    // Loop for sets he has never crafted
                                                    for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                        if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                            if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                hisMaxSets += 5;
                                                            } else {
                                                                hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                        }
                                                        botNSets += botSets[Object.keys(botSets)[i]].length;
                                                    }
                                                    console.log("DEBUG#LOOP 2 DONE");
                                                    // HERE
                                                    if (amountofsets <= hisMaxSets) {
                                                        hisMaxSets = amountofsets;
                                                        console.log("DEBUG#TRADE CREATED");
                                                        sortSetsByAmount(botSets, (DATA) => {
                                                            console.log("DEBUG#" + DATA);
                                                            console.log("DEBUG#SETS SORTED");
                                                            firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                if (b[DATA[i]] === 0) {
                                                                    continue firstLoop;
                                                                } else {
                                                                    console.log("DEBUG#" + i);
                                                                    console.log("DEBUG#FOR LOOP ITEMS");
                                                                    if (hisMaxSets > 0) {
                                                                        console.log("DEBUG#MAXSETSMORETHAN1");
                                                                        if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                            // BOT HAS ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1");
                                                                            sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                    console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                    console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #1: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                            // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                            console.log("DEBUG#LOOP #1 CONTINUE");
                                                                            continue; // *
                                                                        } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                            // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                            bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                        else if (hisMaxSets < 5) {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        } else {
                                                                            // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                            console.log("DEBUG#LOOP #2");
                                                                            xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                    hisMaxSets--;
                                                                                    console.log(hisMaxSets);
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2: RETURN");
                                                                                    continue firstLoop;
                                                                                }
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#RETURN");
                                                                        break firstLoop;
                                                                    }
                                                                }
                                                            }
                                                            if (hisMaxSets > 0) {
                                                                returnJSON.error = "There are not enough sets. Please try again later.";
                                                                return res.end(JSON.stringify(returnJSON));
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addTheirItems(theirKeys);
                                                                t.data("commandused", "Buy");
                                                                t.data("amountofkeys", n);
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        returnJSON.error = "An error occurred while sending your trade. Steam Trades could be down. Please try again later.";
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    } else {
                                                                        returnJSON.error = "Trade sent! Check your Steam!";
                                                                        console.log("## Trade offer sent");
                                                                        return res.end(JSON.stringify(returnJSON));
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        returnJSON.error = "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.";
                                                        return res.end(JSON.stringify(returnJSON));
                                                    }
                                                    // TO HERE
                                                } else {
                                                    console.log("An error occurred while getting badges: " + ERR);
                                                }
                                            } else {
                                                returnJSON.error = "An error occurred while getting your badges. Please try again.";
                                                console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                return res.end(JSON.stringify(returnJSON));
                                            }
                                        });
                                    }
                                } else {
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                    returnJSON.error = "An error occurred while loading your inventory, please make sure it's set to public.";
                                    return res.end(JSON.stringify(returnJSON));
                                }
                            }
                        });
                    } else {
                        returnJSON.error = "Please make sure you don't have a trade hold!";
                        return res.end(JSON.stringify(returnJSON));
                    }
                });
            } else {
                returnJSON.error = "Please try a lower amount of keys.";
                return res.end(JSON.stringify(returnJSON));
            }
        } else {
            returnJSON.error = "Please provide a valid amount of keys.";
            return res.end(JSON.stringify(returnJSON));
        }
    } else {
        returnJSON.error = "Please try again later.";
        return res.end(JSON.stringify(returnJSON));
    }
});

app.post('/gemsbuy', function (req, res) {
    let post = req.body;
    let returnJSON = {
        success: false,
        error: "Unexpected error."
    };
    if (typeof post === 'undefined' || typeof post.keys === 'undefined' || typeof post.steamid === 'undefined' || typeof post.tradelink === 'undefined') {
        returnJSON.error = "Bad params.";
        return res.end(JSON.stringify(returnJSON));
    }
    if (botSets) {
        var n = parseInt(post.keys);
        let amountofsets = parseInt(n);
        if (!isNaN(n) && parseInt(n) > 0) {
            if (n <= config.MESSAGES.MAXBUYGEMS) {
                let t = manager.createOffer(post.tradelink);
                n = parseInt(n);
                let theirGems = [];
                let amountTheirGems = 0;
                t.getUserDetails((ERR, ME, THEM) => {
                    if (ERR) {
                        console.log("## An error occurred while getting trade holds: " + ERR);
                        returnJSON.error = "An error occurred while getting your trade holds. Please check if your profile and inventory are not private and try again.";
                        return res.end(JSON.stringify(returnJSON));
                    } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                        manager.getUserInventoryContents(post.steamid, config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                            if (ERR) {
                                console.log("## An error occurred while getting inventory: " + ERR);
                                returnJSON.error = "An error occurred while loading your inventory. Please try later";
                                return res.end(JSON.stringify(returnJSON));
                            } else {
                                let amountofB = amountofsets;
                                for (let i = 0; i < INV.length; i++) {
                                    if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                        amountTheirGems = INV[i].amount;
                                        INV[i].amount = (n * config.CARDS.GEMS.buy_one_set_for);
                                        theirGems.push(INV[i]);
                                        break;
                                    }
                                }
                                if (amountTheirGems < (n * config.CARDS.GEMS.buy_one_set_for)) {
                                    returnJSON.error = "You do not have enough Gems.";
                                    return res.end(JSON.stringify(returnJSON));
                                } else {
                                    sortSetsByAmount(botSets, (DATA) => {
                                        let setsSent = {};
                                        firstLoop: for (let i = 0; i < DATA.length; i++) {
                                            console.log(setsSent);
                                            console.log(DATA[i]);
                                            if (botSets[DATA[i]]) {
                                                for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                    if (amountofB > 0) {
                                                        if ((setsSent[DATA[i]] && setsSent[DATA[i]] < 5) || !setsSent[DATA[i]]) {
                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                            amountofB--;
                                                            if (!setsSent[DATA[i]]) {
                                                                setsSent[DATA[i]] = 1;
                                                            } else {
                                                                setsSent[DATA[i]] += 1;
                                                            }
                                                        } else {
                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                            continue firstLoop;
                                                        }
                                                    } else {
                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                        continue firstLoop;
                                                    }
                                                }
                                            } else {
                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                continue firstLoop;
                                            }
                                        }
                                    });
                                }
                                if (amountofB > 0) {
                                    returnJSON.error = "There are not enough sets. Please try again later.";
                                    return res.end(JSON.stringify(returnJSON));
                                } else {
                                    console.log("DEBUG#SENDING");
                                    t.addTheirItems(theirGems);
                                    t.data("commandused", "BuyAny");
                                    t.data("amountofsets", amountofsets.toString());
                                    t.data("amountofkeys", n);
                                    t.send((ERR, STATUS) => {
                                        if (ERR) {
                                            returnJSON.error = "An error occurred while sending your trade. Steam Trades could be down. Please try again later.";
                                            console.log("## An error occurred while sending trade: " + ERR);
                                            return res.end(JSON.stringify(returnJSON));
                                        } else {
                                            returnJSON.error = "Trade Sent! Confirming it...";
                                            console.log("## Trade offer sent!");
                                            return res.end(JSON.stringify(returnJSON));
                                        }
                                    });
                                }
                            }
                        });
                    } else {
                        returnJSON.error = "Please make sure you don't have a trade hold!";
                        return res.end(JSON.stringify(returnJSON));
                    }
                });
            } else {
                returnJSON.error = "Please try a lower amount of gems";
                return res.end(JSON.stringify(returnJSON));
            }
        } else {
            returnJSON.error = "Please provide a valid amount of gems.";
            return res.end(JSON.stringify(returnJSON));
        }
    } else {
        returnJSON.error = "Please try again later.";
        return res.end(JSON.stringify(returnJSON));
    }
});

let client = new SteamUser();
let manager = new TradeOfferManager({
    "steam": client,
    "language": "en",
    "pollInterval": "10000",
    "cancelTime": "7200000" // 2 hours in ms
});
let community = new SteamCommunity();

fs.readFile("./UserData/Users.json", (ERR, DATA) => {
    if (ERR) {
        console.log("## An error occurred while getting Users: " + ERR);
    } else {
        users = JSON.parse(DATA);
    }
});

Utils.getCardsInSets((ERR, DATA) => {
    if (!ERR) {
        allCards = DATA;
        console.log("Card data loaded. [" + Object.keys(DATA).length + "]");
    } else {
        console.log("An error occurred while getting cards: " + ERR);
    }
});

setInterval(() => {
    for (let i = 0; i < Object.keys(users).length; i++) {
        if (users[Object.keys(users)[i]].idleforhours >= config.MAXHOURSADDED) {
            client.chatMessage(Object.keys(users)[i], "Hi, you have been inactive on my friends list for too long. If you wish to use this bot again re-add it.");
            client.removeFriend(Object.keys(users)[i]);
            delete users[Object.keys(users)[i]];
            fs.writeFile("./UserData/Users.json", JSON.stringify(users), (ERR) => {
                if (ERR) {
                    console.log("## An error occurred while writing UserData file: " + ERR);
                }
            });
        } else {
            users[Object.keys(users)[i]].idleforhours += 1;
            fs.writeFile("./UserData/Users.json", JSON.stringify(users), (ERR) => {
                if (ERR) {
                    console.log("## An error occurred while writing UserData file: " + ERR);
                }
            });
        }
    }
}, 1000 * 60 * 60);

setInterval(() => {
    for (let i = 0; i < Object.keys(userMsgs).length; i++) {
        if (userMsgs[Object.keys(userMsgs)[i]] > config.MAXMSGPERSEC) {
            client.chatMessage(Object.keys(userMsgs)[i], "You have been removed for spamming. Another offense will get you blocked.");
            client.removeFriend(Object.keys(userMsgs)[i]);
            for (let j = 0; j < config.ADMINS.length; j++) {
                client.chatMessage(config.ADMINS[j], "User #" + Object.keys(userMsgs)[i] + " has been removed for spamming. To block him use !block [STEAMID64]");
            }
        }
    }
    userMsgs = {};
}, 1000);

client.logOn({
    accountName: config.USERNAME,
    password: config.PASSWORD,
    twoFactorCode: SteamTotp.getAuthCode(config.SHAREDSECRET),
    rememberPassword: true
});

client.on("loggedOn", (details, parental) => {
    client.getPersonas([client.steamID], (personas) => {
        console.log("## Logged in as #" + client.steamID + " (" + personas[client.steamID].player_name + ")");
    });
    client.setPersona(1, config.PROFILE.NAME + config.CARDS.CSGO.buy_sets_by_one + ":1");
});

client.on("webSession", (sessionID, cookies) => {
    manager.setCookies(cookies, (ERR) => {
        if (ERR) {
            console.log("## An error occurred while setting cookies.");
        } else {
            console.log("## Websession created and cookies set.");
        }
    });
    community.setCookies(cookies);
    community.startConfirmationChecker(10000, config.IDENTITYSECRET);
    Utils.getInventory(client.steamID.getSteamID64(), community, (ERR, DATA) => {
        console.log("DEBUG#INVLOADED");
        if (!ERR) {
            let s = DATA;
            Utils.getSets(s, allCards, (ERR, DATA) => {
                console.log("DEBUG#SETSLOADED");
                if (!ERR) {
                    botSets = DATA;
                    console.log("## Bot's sets loaded.");
                    let botNSets = 0;
                    for (let i = 0; i < Object.keys(botSets).length; i++) {
                        botNSets += botSets[Object.keys(botSets)[i]].length;
                    }
                    totalBotSets = botNSets;
                    let playThis = config.PLAYGAMES;
                    playThis[0] =
                        totalBotSets + " Sets | " +
                        config.CARDS.CSGO.buy_sets_by_one + ":1 CS:GO | " +
                        config.CARDS.TF2.buy_sets_by_one + ":1 TF2 | " +
                        config.CARDS.PUBG.buy_sets_by_one + ":1 PUBG | " +
                        config.CARDS.GEMS.buy_one_set_for + " Gems 1 Set";
                    client.gamesPlayed(playThis);
                } else {
                    console.log("## An error occurred while getting bot sets: " + ERR);
                    process.exit();
                }
            });
        } else {
            console.log("## An error occurred while getting bot inventory: " + ERR);
        }
    });
});

community.on("sessionExpired", (ERR) => {
    console.log("## Session Expired. Relogging.");
    client.webLogOn();
});

client.on("friendMessage", (SENDER, MSG) => {
    if (userLogs[SENDER.getSteamID64()]) {
        userLogs[SENDER.getSteamID64()].push(MSG);
    } else {
        userLogs[SENDER.getSteamID64()] = [];
        userLogs[SENDER.getSteamID64()].push(MSG);
    }
    fs.writeFile("./ChatLogs/UserLogs/" + SENDER.getSteamID64() + "-log-" + new Date().getDate() + "-" + new Date().getMonth() + "-" + new Date().getFullYear() + ".json", JSON.stringify({logs: userLogs[SENDER.getSteamID64()]}), (ERR) => {
        if (ERR) {
            console.log("## An error occurred while writing UserLogs file: " + ERR);
        }
    });
    chatLogs += SENDER.getSteamID64() + " : " + MSG + "\n";
    fs.writeFile("./ChatLogs/FullLogs/log-" + new Date().getDate() + "-" + new Date().getMonth() + "-" + new Date().getFullYear() + ".txt", chatLogs, (ERR) => {
        if (ERR) {
            console.log("## An error occurred while writing FullLogs file: " + ERR);
        }
    });
    if (Object.keys(users).indexOf(SENDER.getSteamID64()) < 0) {
        users[SENDER.getSteamID64()] = {};
        users[SENDER.getSteamID64()].idleforhours = 0;
        fs.writeFile("./UserData/Users.json", JSON.stringify(users), (ERR) => {
            if (ERR) {
                console.log("## An error occurred while writing UserData file: " + ERR);
            }
        });
    } else {
        users[SENDER.getSteamID64()].idleforhours = 0;
    }
    if (userMsgs[SENDER.getSteamID64()]) {
        userMsgs[SENDER.getSteamID64()]++;
    } else {
        userMsgs[SENDER.getSteamID64()] = 1;
    }
    let isAdmin = (config.ADMINS.indexOf(SENDER.getSteamID64()) >= 0 || config.ADMINS.indexOf(parseInt(SENDER.getSteamID64())) >= 0);

    let command = MSG.slice(1).toUpperCase().split(" ");

    if (!isAdmin && restock) {
        //client.chatMessage(SENDER, "We are filling our bot with new sets right now. Try our bot again in few minutes.");
        return false;
    }
    let myentries;
    switch (command[0]) {

        // Main
        case "HELP":
            client.chatMessage(SENDER, "\nList of commands:" +
                "\n\n!owner - show the admin profile, if you have any problems you may contact me!" +
                "\n\n!credits - show the developers of this bot." +
                "\n\n!level [your dream level] - calculate how many sets and how many keys it will cost to desired level" +
                "\n\n!check - show how many sets the bot have available and how much you can craft" +
                "\n\n!check [amount] - show how many sets and which level you would reach for a specific amount of keys" +
                "\n\n!checktf [amount] - show how many sets and which level you would reach for a specific amount of keys" +
                "\n\n!checkgems [amount] - show how many sets and which level you would reach for a specific amount of gems" +
                "\n\n!buy [amount of CS:GO keys] - use to buy that amount of CS:GO keys for sets you dont have, following the current BOT rate" +
                "\n\n!buytf [amount of CS:GO keys] - use to buy that amount of TF2 keys for sets you dont have, following the current BOT rate" +
                "\n\n!buypubg [amount of PUBG keys] - use to buy that amount of PUBG keys for sets you dont have, following the current BOT rate" +
                "\n\n!buygems [amount of sets] - use to buy that amount of sets for gems, following the current BOT rate" +
                "\n\n!buyany [amount of CS:GO keys] - use to buy that amount of CS:GO keys for any sets, following the current BOT rate" +
                "\n\n!buyanytf [amount of TF2 keys] - use to buy that amount of TF2 keys for any sets, following the current BOT rate" +
                "\n\n!buyanypubg [amount of PUBG keys] - use to buy that amount of PUBG keys for any sets, following the current BOT rate" +
                "\n\n!buyanygems [amount of sets] - use to buy that amount of any sets for gems, following the current BOT rate" +
                "\n\n!buyone [amount of CS:GO keys] - use this if you are a badge collector. BOT will send only one set of each game, following the current BOT rate" +
                "\n\n!buyonetf [amount of TF2 keys] - use this if you are a badge collector. BOT will send only one set of each game, following the current BOT rate" +
                "\n\n!buyonepubg [amount of PUBG keys] - use this if you are a badge collector. BOT will send only one set of each game, following the current BOT rate" +
                "\n\n!buyonegems [amount of sets] - use this if you are a badge collector. sames as !buyone , buy you pay with gems!" +
                "\n\n!sell [amount of CS:GO keys] - use to sell your sets for CS:GO Key(s)" +
                "\n\n!sellgems [amount of sets] - use to sell your sets for Gems" +
                "\n\n!selltf [amount of TF2 keys] - use to sell your sets for TF2 Key(s)" +
                "\n\n!sellpubg [amount of PUBG keys] - use to sell your sets for PUBG Key(s)" +
                "\n\n!sellcheck [amount of CS:GO keys] - use to check information about sets you can sell" +
                "\n\n!enter - Enter giveaway (If any)" +
                "\n\n!giveaway - Get info about giveaway and your entries"
            );
            break;
        case "LEVEL":
            var n = parseInt(command[1]);
            if (!isNaN(n) && parseInt(n) > 0) {
                if (n <= config.MESSAGES.MAXLEVEL) {
                    Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA, CURRENTLEVEL, XPNEEDED) => {
                        if (!ERR) {
                            if (DATA) {
                                if (n > CURRENTLEVEL) {
                                    let s = 0,
                                        l = 0;
                                    for (let i = 0; i < (n - CURRENTLEVEL); i++) {
                                        s += parseInt((CURRENTLEVEL + l) / 10) + 1;
                                        l++;
                                    }
                                    client.chatMessage(SENDER, "To get to level " + n + " you will need " + (s - Math.floor(XPNEEDED / 100)) + " sets.\r\nThat would cost:" +
                                        "\r\n" + parseInt((s - Math.floor(XPNEEDED / 100)) / config.CARDS.CSGO.buy_sets_by_one * 100) / 100 + " CS:GO Key(s)" +
                                        "\r\n" + parseInt((s - Math.floor(XPNEEDED / 100)) / config.CARDS.TF2.buy_sets_by_one * 100) / 100 + " TF2 Key(s)" +
                                        "\r\n" + ((s - Math.floor(XPNEEDED / 100)) * config.CARDS.GEMS.buy_one_set_for) + " Gems"
                                    );
                                } else {
                                    client.chatMessage(SENDER, "Please provide a valid level.");
                                }
                            } else {
                                client.chatMessage(SENDER, "Your level could not be retrieved. Make sure your Steam Profile is public and try again.");
                            }
                        } else {
                            console.log("## An error occurred while getting badge data: " + ERR);
                            client.chatMessage(SENDER, "An error occurred while loading your badges. Please try again later.");
                        }
                    });
                } else {
                    client.chatMessage(SENDER, "Please try a lower level.");
                }
            } else {
                client.chatMessage(SENDER, "Please provide a valid level.");
            }
            break;

        // Giveaway
        case "GIVEAWAY":
            giveawayJSON = jsonfile.readFileSync(giveawayfilename);
            myentries = 0;
            if (giveawayJSON.active) {
                let length = Object.keys(giveawayJSON.entries).length;
                for (let i = 0; i < length; i++) {
                    let j = Object.keys(giveawayJSON.entries)[i];
                    if (j === SENDER.getSteamID64()) {
                        myentries = giveawayJSON.entries[j];
                        break;
                    }
                }
                client.chatMessage(SENDER, "\nRunning giveaway:" +
                    "\r\nPrice: " + giveawayJSON.prize +
                    "\r\nEnd: " + giveawayJSON.end +
                    (myentries > 0 ? "\r\nMy entries: " + myentries : "Enter using !enter command")
                );
            } else {
                client.chatMessage(SENDER, "\nI currently don't have any giveaway. Try again later...");
            }
            break;
        case "ENTER":
            giveawayJSON = jsonfile.readFileSync(giveawayfilename);
            myentries = 0;
            if (giveawayJSON.active) {
                let length = Object.keys(giveawayJSON.entries).length;
                for (let i = 0; i < length; i++) {
                    let j = Object.keys(giveawayJSON.entries)[i];
                    if (j === SENDER.getSteamID64()) {
                        myentries = giveawayJSON.entries[j];
                        break;
                    }
                }
                if (myentries === 0) {
                    giveawayJSON = jsonfile.readFileSync(giveawayfilename);
                    giveawayJSON.entries[SENDER.getSteamID64()] = 1;

                    fs.writeFile(giveawayfilename, JSON.stringify(giveawayJSON, null, "\t"), function (err) {
                        if (err) return console.log(err);
                        console.log('Giveaway entry added! (' + SENDER.getSteamID64() + ')');
                    });
                    client.chatMessage(SENDER, "\nYou successfully entered giveaway!" +
                        "\r\nPrice: " + giveawayJSON.prize +
                        "\r\nEnd: " + giveawayJSON.end +
                        "\r\n\nYou can get more entries by trading with me!"
                    );
                } else {
                    client.chatMessage(SENDER, "\nYou already entered giveaway!" +
                        "\r\nYou can get more entries by trading with me!"
                    );
                }
            } else {
                client.chatMessage(SENDER, "\nI currently don't have any giveaway. Try again later...");
            }
            break;

        // Buy
        case "BUY":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.CSGO.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                                    // BOT HAS ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1");
                                                                                    sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                        if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                            console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                            console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #1: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                                    // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1 CONTINUE");
                                                                                    continue; // *
                                                                                } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else if (hisMaxSets < 5) {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "Buy");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYTF":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.TF2.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                                    // BOT HAS ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1");
                                                                                    sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                        if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                            console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                            console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #1: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                                    // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1 CONTINUE");
                                                                                    continue; // *
                                                                                } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else if (hisMaxSets < 5) {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "Buy");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYGEMS":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n);
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        n = parseInt(n);
                        let theirGems = [];
                        let amountTheirGems = 0;
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        let amountofB = amountofsets;
                                        for (let i = 0; i < INV.length; i++) {
                                            if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                                amountTheirGems = INV[i].amount;
                                                INV[i].amount = (n * config.CARDS.GEMS.buy_one_set_for);
                                                theirGems.push(INV[i]);
                                                break;
                                            }
                                        }
                                        if (amountTheirGems < (n * config.CARDS.GEMS.buy_one_set_for)) {
                                            client.chatMessage(SENDER, "You do not have enough Gems.");
                                        } else {
                                            sortSetsByAmount(botSets, (DATA) => {
                                                let setsSent = {};
                                                firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                    console.log(setsSent);
                                                    console.log(DATA[i]);
                                                    if (botSets[DATA[i]]) {
                                                        for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                            if (amountofB > 0) {
                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < 5) || !setsSent[DATA[i]]) {
                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                    amountofB--;
                                                                    if (!setsSent[DATA[i]]) {
                                                                        setsSent[DATA[i]] = 1;
                                                                    } else {
                                                                        setsSent[DATA[i]] += 1;
                                                                    }
                                                                } else {
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                    continue firstLoop;
                                                                }
                                                            } else {
                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                continue firstLoop;
                                                            }
                                                        }
                                                    } else {
                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                        continue firstLoop;
                                                    }
                                                }
                                            });
                                        }
                                        if (amountofB > 0) {
                                            client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                        } else {
                                            console.log("DEBUG#SENDING");
                                            t.addTheirItems(theirGems);
                                            t.data("commandused", "BuyAny");
                                            t.data("amountofsets", amountofsets.toString());
                                            t.data("amountofkeys", n);
                                            t.send((ERR, STATUS) => {
                                                if (ERR) {
                                                    client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                    console.log("## An error occurred while sending trade: " + ERR);
                                                } else {
                                                    client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                    console.log("## Trade offer sent!");
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYPUBG":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.PUBG.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.PUBGGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.PUBGACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                                    // BOT HAS ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1");
                                                                                    sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                        if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                            console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                            console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #1: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                                    // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1 CONTINUE");
                                                                                    continue; // *
                                                                                } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else if (hisMaxSets < 5) {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "Buy");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;

        // Buy any
        case "BUYANY":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.CSGO.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        n = parseInt(n);
                        let theirKeys = [];
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        let amountofB = amountofsets;
                                        for (let i = 0; i < INV.length; i++) {
                                            if (theirKeys.length < n && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                theirKeys.push(INV[i]);
                                            }
                                        }
                                        if (theirKeys.length !== n) {
                                            client.chatMessage(SENDER, "You do not have enough keys.");
                                        } else {
                                            sortSetsByAmount(botSets, (DATA) => {
                                                let setsSent = {};
                                                firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                    console.log(setsSent);
                                                    console.log(DATA[i]);
                                                    if (botSets[DATA[i]]) {
                                                        for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                            if (amountofB > 0) {
                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < 5) || !setsSent[DATA[i]]) {
                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                    amountofB--;
                                                                    if (!setsSent[DATA[i]]) {
                                                                        setsSent[DATA[i]] = 1;
                                                                    } else {
                                                                        setsSent[DATA[i]] += 1;
                                                                    }
                                                                } else {
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                    continue firstLoop;
                                                                }
                                                            } else {
                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                continue firstLoop;
                                                            }
                                                        }
                                                    } else {
                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                        continue firstLoop;
                                                    }
                                                }
                                            });
                                        }
                                        if (amountofB > 0) {
                                            client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                        } else {
                                            console.log("DEBUG#SENDING");
                                            t.addTheirItems(theirKeys);
                                            t.data("commandused", "BuyAny");
                                            t.data("amountofsets", amountofsets.toString());
                                            t.data("amountofkeys", n);
                                            t.send((ERR, STATUS) => {
                                                if (ERR) {
                                                    client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                    console.log("## An error occurred while sending trade: " + ERR);
                                                } else {
                                                    client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                    console.log("## Trade offer sent!");
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYANYTF":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.TF2.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        n = parseInt(n);
                        let theirKeys = [];
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        let amountofB = amountofsets;
                                        for (let i = 0; i < INV.length; i++) {
                                            if (theirKeys.length < n && config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                theirKeys.push(INV[i]);
                                            }
                                        }
                                        if (theirKeys.length !== n) {
                                            client.chatMessage(SENDER, "You do not have enough keys.");
                                        } else {
                                            sortSetsByAmount(botSets, (DATA) => {
                                                let setsSent = {};
                                                firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                    console.log(setsSent);
                                                    console.log(DATA[i]);
                                                    if (botSets[DATA[i]]) {
                                                        for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                            if (amountofB > 0) {
                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < 5) || !setsSent[DATA[i]]) {
                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                    amountofB--;
                                                                    if (!setsSent[DATA[i]]) {
                                                                        setsSent[DATA[i]] = 1;
                                                                    } else {
                                                                        setsSent[DATA[i]] += 1;
                                                                    }
                                                                } else {
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                    continue firstLoop;
                                                                }
                                                            } else {
                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                continue firstLoop;
                                                            }
                                                        }
                                                    } else {
                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                        continue firstLoop;
                                                    }
                                                }
                                            });
                                        }
                                        if (amountofB > 0) {
                                            client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                        } else {
                                            console.log("DEBUG#SENDING");
                                            t.addTheirItems(theirKeys);
                                            t.data("commandused", "BuyAny");
                                            t.data("amountofsets", amountofsets.toString());
                                            t.data("amountofkeys", n);
                                            t.send((ERR, STATUS) => {
                                                if (ERR) {
                                                    client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                    console.log("## An error occurred while sending trade: " + ERR);
                                                } else {
                                                    client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                    console.log("## Trade offer sent!");
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYANYPUBG":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.PUBG.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        n = parseInt(n);
                        let theirKeys = [];
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.PUBGGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        let amountofB = amountofsets;
                                        for (let i = 0; i < INV.length; i++) {
                                            if (theirKeys.length < n && config.PUBGACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                theirKeys.push(INV[i]);
                                            }
                                        }
                                        if (theirKeys.length !== n) {
                                            client.chatMessage(SENDER, "You do not have enough keys.");
                                        } else {
                                            sortSetsByAmount(botSets, (DATA) => {
                                                let setsSent = {};
                                                firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                    console.log(setsSent);
                                                    console.log(DATA[i]);
                                                    if (botSets[DATA[i]]) {
                                                        for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                            if (amountofB > 0) {
                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < 5) || !setsSent[DATA[i]]) {
                                                                    t.addMyItems(botSets[DATA[i]][j]);
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                    amountofB--;
                                                                    if (!setsSent[DATA[i]]) {
                                                                        setsSent[DATA[i]] = 1;
                                                                    } else {
                                                                        setsSent[DATA[i]] += 1;
                                                                    }
                                                                } else {
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                    continue firstLoop;
                                                                }
                                                            } else {
                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                continue firstLoop;
                                                            }
                                                        }
                                                    } else {
                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                        continue firstLoop;
                                                    }
                                                }
                                            });
                                        }
                                        if (amountofB > 0) {
                                            client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                        } else {
                                            console.log("DEBUG#SENDING");
                                            t.addTheirItems(theirKeys);
                                            t.data("commandused", "BuyAny");
                                            t.data("amountofsets", amountofsets.toString());
                                            t.data("amountofkeys", n);
                                            t.send((ERR, STATUS) => {
                                                if (ERR) {
                                                    client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                    console.log("## An error occurred while sending trade: " + ERR);
                                                } else {
                                                    client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                    console.log("## Trade offer sent!");
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYANYGEMS":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n);
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirGems = [];
                                let amountTheirGems = 0;
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    amountTheirGems = INV[i].amount;
                                                    INV[i].amount = (n * config.CARDS.GEMS.buy_one_set_for);
                                                    theirGems.push(INV[i]);
                                                    break;
                                                }
                                            }
                                            if (amountTheirGems < (n * config.CARDS.GEMS.buy_one_set_for)) {
                                                client.chatMessage(SENDER, "You do not have enough Gems.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (b[DATA[i]] && botSets[DATA[i]].length >= b[DATA[i]]) {
                                                                                    // BOT HAS ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1");
                                                                                    sLoop: for (let j = 0; j < 5 - b[DATA[i]]; j++) {
                                                                                        if (j + 1 < b[DATA[i]] && hisMaxSets > 0) {
                                                                                            console.log("DEBUG#LOOP #1: ITEM ADD");
                                                                                            console.log("DEBUG#LOOP #1: " + botSets[DATA[i]][j]);
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #1: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else if (b[DATA[i]] && botSets[DATA[i]].length < b[DATA[i]]) {
                                                                                    // BOT DOESNT HAVE ENOUGH SETS OF THIS KIND
                                                                                    console.log("DEBUG#LOOP #1 CONTINUE");
                                                                                    continue; // *
                                                                                } else if (!b[DATA[i]] && botSets[DATA[i]].length < 5 && botSets[DATA[i]].length - b[DATA[i]] > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length - b[DATA[i]]; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                else if (hisMaxSets < 5) {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    tLoop: for (let j = 0; j !== hisMaxSets; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                } else {
                                                                                    // BOT DOESNT HAVE CARDS USER AREADY CRAFTED, IF USER STILL NEEDS LESS THAN 5 SETS:
                                                                                    console.log("DEBUG#LOOP #2");
                                                                                    xLoop: for (let j = 0; j !== 5; j++ && hisMaxSets > 0) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            console.log(hisMaxSets);
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirGems);
                                                                        t.data("commandused", "Buy");
                                                                        //t.data("amountofkeys", n);
                                                                        //t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of sets.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of sets.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;

        // Buy one
        case "BUYONE":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.CSGO.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            totalBotSets = botNSets;
                                                            let playThis = config.PLAYGAMES;
                                                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                                                playThis[0] = parseString(playThis[0], totalBotSets);
                                                            }
                                                            client.gamesPlayed(playThis);
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (!b[DATA[i]] && botSets[DATA[i]].length > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            continue firstLoop;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "BuyOne");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYONETF":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.TF2.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            totalBotSets = botNSets;
                                                            let playThis = config.PLAYGAMES;
                                                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                                                playThis[0] = parseString(playThis[0], totalBotSets);
                                                            }
                                                            client.gamesPlayed(playThis);
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (!b[DATA[i]] && botSets[DATA[i]].length > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            continue firstLoop;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "BuyOne");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYONEPUBG":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n) * config.CARDS.PUBG.buy_sets_by_one;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirKeys = [];
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.PUBGGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < n && config.PUBGACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== n) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            totalBotSets = botNSets;
                                                            let playThis = config.PLAYGAMES;
                                                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                                                playThis[0] = parseString(playThis[0], totalBotSets);
                                                            }
                                                            client.gamesPlayed(playThis);
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (!b[DATA[i]] && botSets[DATA[i]].length > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            continue firstLoop;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirKeys);
                                                                        t.data("commandused", "BuyOne");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of keys.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "BUYONEGEMS":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = parseInt(n);
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXBUY) {
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                n = parseInt(n);
                                let theirGems = [];
                                let amountTheirGems = 0;
                                client.chatMessage(SENDER, "Processing your request.");
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    amountTheirGems = INV[i].amount;
                                                    INV[i].amount = (n * config.CARDS.GEMS.buy_one_set_for);
                                                    theirGems.push(INV[i]);
                                                    break;
                                                }
                                            }
                                            if (amountTheirGems < (n * config.CARDS.GEMS.buy_one_set_for)) {
                                                client.chatMessage(SENDER, "You do not have enough Gems.");
                                            } else {
                                                Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                                                    if (!ERR) {
                                                        console.log("DEBUG#BADGE LOADED");
                                                        if (!ERR) {
                                                            let b = {}; // List with badges that CAN still be crafted
                                                            if (DATA) {
                                                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                                    }
                                                                }
                                                            } else {
                                                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                                                            }
                                                            console.log(DATA);
                                                            console.log(b);
                                                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                                            // 1: GET BOTS CARDS. DONE
                                                            // 2: GET PLAYER's BADGES. DONE
                                                            // 3: MAGIC
                                                            let hisMaxSets = 0,
                                                                botNSets = 0;
                                                            // Loop for sets he has partially completed
                                                            for (let i = 0; i < Object.keys(b).length; i++) {
                                                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                                                }
                                                            }
                                                            console.log("DEBUG#LOOP 1 DONE");
                                                            // Loop for sets he has never crafted
                                                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                                        hisMaxSets += 5;
                                                                    } else {
                                                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                                    }
                                                                }
                                                                botNSets += botSets[Object.keys(botSets)[i]].length;
                                                            }
                                                            totalBotSets = botNSets;
                                                            let playThis = config.PLAYGAMES;
                                                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                                                playThis[0] = parseString(playThis[0], totalBotSets);
                                                            }
                                                            client.gamesPlayed(playThis);
                                                            console.log("DEBUG#LOOP 2 DONE");
                                                            // HERE
                                                            if (amountofsets <= hisMaxSets) {
                                                                hisMaxSets = amountofsets;
                                                                console.log("DEBUG#TRADE CREATED");
                                                                sortSetsByAmount(botSets, (DATA) => {
                                                                    console.log("DEBUG#" + DATA);
                                                                    console.log("DEBUG#SETS SORTED");
                                                                    firstLoop: for (let i = 0; i < DATA.length; i++) {
                                                                        if (b[DATA[i]] === 0) {
                                                                            continue firstLoop;
                                                                        } else {
                                                                            console.log("DEBUG#" + i);
                                                                            console.log("DEBUG#FOR LOOP ITEMS");
                                                                            if (hisMaxSets > 0) {
                                                                                console.log("DEBUG#MAXSETSMORETHAN1");
                                                                                if (!b[DATA[i]] && botSets[DATA[i]].length > 0) { // TODO NOT FOR LOOP WITH BOTSETS. IT SENDS ALL
                                                                                    // BOT HAS ENOUGH SETS AND USER NEVER CRAFTED THIS
                                                                                    bLoop: for (let j = 0; j < botSets[DATA[i]].length; j++) {
                                                                                        if (botSets[DATA[i]][j] && hisMaxSets > 0) {
                                                                                            t.addMyItems(botSets[DATA[i]][j]);
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                            hisMaxSets--;
                                                                                            continue firstLoop;
                                                                                        } else {
                                                                                            console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                            continue firstLoop;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#RETURN");
                                                                                break firstLoop;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (hisMaxSets > 0) {
                                                                        client.chatMessage(SENDER, "There are not enough sets. Please try again later.");
                                                                    } else {
                                                                        console.log("DEBUG#SENDING");
                                                                        t.addTheirItems(theirGems);
                                                                        t.data("commandused", "BuyOne");
                                                                        t.data("amountofkeys", n);
                                                                        t.data("amountofsets", amountofsets.toString());
                                                                        t.send((ERR, STATUS) => {
                                                                            if (ERR) {
                                                                                client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                                console.log("## An error occurred while sending trade: " + ERR);
                                                                            } else {
                                                                                client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                                console.log("## Trade offer sent");
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                client.chatMessage(SENDER, "There are currently not enough sets that you have not used in stock for this amount of keys. Please try again later. If you want the bot to ignore your current badges use !buyany.");
                                                            }
                                                            // TO HERE
                                                        } else {
                                                            console.log("An error occurred while getting badges: " + ERR);
                                                        }
                                                    } else {
                                                        client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                                                        console.log(SENDER, "## An error occurred while loading badges: " + ERR);
                                                    }
                                                });
                                            }
                                        } else {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory, please make sure it's set to public.");
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of Sets.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please provide a valid amount of Sets.");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;

        // Sell
        case "SELL":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = n * config.CARDS.CSGO.give_one_for;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXSELL) {
                        client.chatMessage(SENDER, "Processing your request.");
                        let botKeys = [],
                            t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                manager.getUserInventoryContents(client.steamID.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting bot inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading the bot's inventory. Please try again.");
                                    } else {
                                        for (let i = 0; i < INV.length; i++) {
                                            if (botKeys.length < n && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                botKeys.push(INV[i]);
                                            }
                                        }
                                        if (botKeys.length !== n) {
                                            client.chatMessage(SENDER, "The bot does not have enough keys.");
                                        } else {
                                            let amountofB = amountofsets;
                                            Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                                                if (!ERR) {
                                                    let s = DATA;
                                                    Utils.getSets(s, allCards, (ERR, DDATA) => {
                                                        if (!ERR) {
                                                            sortSetsByAmountB(s, (DATA) => {
                                                                let setsSent = {};
                                                                firsttLoop: for (let i = 0; i < DATA.length; i++) {
                                                                    console.log(setsSent);
                                                                    console.log(DATA[i]);
                                                                    if (DDATA[DATA[i]]) {
                                                                        for (let j = 0; j < DDATA[DATA[i]].length; j++) {
                                                                            if (amountofB > 0) {
                                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < config.CARDS.CSGO.MAXSETSELL) || !setsSent[DATA[i]]) {
                                                                                    t.addTheirItems(DDATA[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    amountofB--;
                                                                                    if (!setsSent[DATA[i]]) {
                                                                                        setsSent[DATA[i]] = 1;
                                                                                    } else {
                                                                                        setsSent[DATA[i]] += 1;
                                                                                    }
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firsttLoop;
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                continue firsttLoop;
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                                        continue firsttLoop;
                                                                    }
                                                                }
                                                            });
                                                            if (amountofB > 0) {
                                                                client.chatMessage(SENDER, "You do not have enough sets, (this bot only accepts " + config.CARDS.CSGO.MAXSETSELL + " sets per set type at a time). Please try again later.");
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addMyItems(botKeys);
                                                                t.data("commandused", "Sell");
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.data("amountofkeys", n);
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                    } else {
                                                                        client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                        console.log("## Trade offer sent!");
                                                                    }
                                                                });
                                                            }
                                                        } else {
                                                            console.log("## An error occurred while getting bot sets: " + ERR);
                                                        }
                                                    });
                                                } else {
                                                    console.log("## An error occurred while getting user inventory: " + ERR);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "SELLTF":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = n * config.CARDS.TF2.give_one_for;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXSELL) {
                        client.chatMessage(SENDER, "Processing your request.");
                        let botKeys = [],
                            t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                manager.getUserInventoryContents(client.steamID.getSteamID64(), config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting bot inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading the bot's inventory. Please try again.");
                                    } else {
                                        for (let i = 0; i < INV.length; i++) {
                                            if (botKeys.length < n && config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                botKeys.push(INV[i]);
                                            }
                                        }
                                        if (botKeys.length !== n) {
                                            client.chatMessage(SENDER, "The bot does not have enough keys.");
                                        } else {
                                            let amountofB = amountofsets;
                                            Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                                                if (!ERR) {
                                                    let s = DATA;
                                                    Utils.getSets(s, allCards, (ERR, DDATA) => {
                                                        if (!ERR) {
                                                            sortSetsByAmountB(s, (DATA) => {
                                                                let setsSent = {};
                                                                firsttLoop: for (let i = 0; i < DATA.length; i++) {
                                                                    console.log(setsSent);
                                                                    console.log(DATA[i]);
                                                                    if (DDATA[DATA[i]]) {
                                                                        for (let j = 0; j < DDATA[DATA[i]].length; j++) {
                                                                            if (amountofB > 0) {
                                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < config.CARDS.TF2.MAXSETSELL) || !setsSent[DATA[i]]) {
                                                                                    t.addTheirItems(DDATA[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    amountofB--;
                                                                                    if (!setsSent[DATA[i]]) {
                                                                                        setsSent[DATA[i]] = 1;
                                                                                    } else {
                                                                                        setsSent[DATA[i]] += 1;
                                                                                    }
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firsttLoop;
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                continue firsttLoop;
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                                        continue firsttLoop;
                                                                    }
                                                                }
                                                            });
                                                            if (amountofB > 0) {
                                                                client.chatMessage(SENDER, "You do not have enough sets, (this bot only accepts " + config.CARDS.TF2.MAXSETSELL + " sets per set type at a time). Please try again later.");
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addMyItems(botKeys);
                                                                t.data("commandused", "Sell");
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.data("amountofkeys", n);
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                    } else {
                                                                        client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                        console.log("## Trade offer sent!");
                                                                    }
                                                                });
                                                            }
                                                        } else {
                                                            console.log("## An error occurred while getting bot sets: " + ERR);
                                                        }
                                                    });
                                                } else {
                                                    console.log("## An error occurred while getting user inventory: " + ERR);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "SELLGEMS":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = n;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXSELL) {
                        client.chatMessage(SENDER, "Processing your request.");
                        let gemsAmount = 0;
                        let botGems = [];
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                manager.getUserInventoryContents(client.steamID.getSteamID64(), config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting bot inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading the bot's inventory. Please try again.");
                                    } else {
                                        for (let i = 0; i < INV.length; i++) {
                                            if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                                gemsAmount = INV[i].amount;
                                                INV[i].amount = (n * config.CARDS.GEMS.give_one_set_for);
                                                botGems.push(INV[i]);
                                                break;
                                            }
                                        }
                                        if (gemsAmount < n) {
                                            client.chatMessage(SENDER, "The bot does not have enough Gems.");
                                        } else {
                                            let amountofB = amountofsets;
                                            Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                                                if (!ERR) {
                                                    let s = DATA;
                                                    Utils.getSets(s, allCards, (ERR, DDATA) => {
                                                        if (!ERR) {
                                                            sortSetsByAmountB(s, (DATA) => {
                                                                let setsSent = {};
                                                                firsttLoop: for (let i = 0; i < DATA.length; i++) {
                                                                    console.log(setsSent);
                                                                    console.log(DATA[i]);
                                                                    if (DDATA[DATA[i]]) {
                                                                        for (let j = 0; j < DDATA[DATA[i]].length; j++) {
                                                                            if (amountofB > 0) {
                                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < config.CARDS.TF2.MAXSETSELL) || !setsSent[DATA[i]]) {
                                                                                    t.addTheirItems(DDATA[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    amountofB--;
                                                                                    if (!setsSent[DATA[i]]) {
                                                                                        setsSent[DATA[i]] = 1;
                                                                                    } else {
                                                                                        setsSent[DATA[i]] += 1;
                                                                                    }
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firsttLoop;
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                continue firsttLoop;
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                                        continue firsttLoop;
                                                                    }
                                                                }
                                                            });
                                                            if (amountofB > 0) {
                                                                client.chatMessage(SENDER, "You do not have enough sets, (this bot only accepts " + config.CARDS.GEMS.MAXSETSELL + " sets per set type at a time). Please try again later.");
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addMyItems(botGems);
                                                                t.data("commandused", "Sell");
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.data("amountofkeys", n);
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                    } else {
                                                                        client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                        console.log("## Trade offer sent!");
                                                                    }
                                                                });
                                                            }
                                                        } else {
                                                            console.log("## An error occurred while getting bot sets: " + ERR);
                                                        }
                                                    });
                                                } else {
                                                    console.log("## An error occurred while getting user inventory: " + ERR);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of sets.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please enter a valid amount of setss!");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;
        case "SELLPUBG":
            if (botSets) {
                var n = parseInt(command[1]);
                let amountofsets = n * config.CARDS.PUBG.give_one_for;
                if (!isNaN(n) && parseInt(n) > 0) {
                    if (n <= config.MESSAGES.MAXSELL) {
                        client.chatMessage(SENDER, "Processing your request.");
                        let botKeys = [],
                            t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                manager.getUserInventoryContents(client.steamID.getSteamID64(), config.PUBGGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting bot inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading the bot's inventory. Please try again.");
                                    } else {
                                        for (let i = 0; i < INV.length; i++) {
                                            if (botKeys.length < n && config.PUBGACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                botKeys.push(INV[i]);
                                            }
                                        }
                                        if (botKeys.length !== n) {
                                            client.chatMessage(SENDER, "The bot does not have enough keys.");
                                        } else {
                                            let amountofB = amountofsets;
                                            Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                                                if (!ERR) {
                                                    let s = DATA;
                                                    Utils.getSets(s, allCards, (ERR, DDATA) => {
                                                        if (!ERR) {
                                                            sortSetsByAmountB(s, (DATA) => {
                                                                let setsSent = {};
                                                                firsttLoop: for (let i = 0; i < DATA.length; i++) {
                                                                    console.log(setsSent);
                                                                    console.log(DATA[i]);
                                                                    if (DDATA[DATA[i]]) {
                                                                        for (let j = 0; j < DDATA[DATA[i]].length; j++) {
                                                                            if (amountofB > 0) {
                                                                                if ((setsSent[DATA[i]] && setsSent[DATA[i]] < config.CARDS.PUBG.MAXSETSELL) || !setsSent[DATA[i]]) {
                                                                                    t.addTheirItems(DDATA[DATA[i]][j]);
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                                    amountofB--;
                                                                                    if (!setsSent[DATA[i]]) {
                                                                                        setsSent[DATA[i]] = 1;
                                                                                    } else {
                                                                                        setsSent[DATA[i]] += 1;
                                                                                    }
                                                                                } else {
                                                                                    console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                    continue firsttLoop;
                                                                                }
                                                                            } else {
                                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN");
                                                                                continue firsttLoop;
                                                                            }
                                                                        }
                                                                    } else {
                                                                        console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                                        continue firsttLoop;
                                                                    }
                                                                }
                                                            });
                                                            if (amountofB > 0) {
                                                                client.chatMessage(SENDER, "You do not have enough sets, (this bot only accepts " + config.CARDS.PUBG.MAXSETSELL + " sets per set type at a time). Please try again later.");
                                                            } else {
                                                                console.log("DEBUG#SENDING");
                                                                t.addMyItems(botKeys);
                                                                t.data("commandused", "Sell");
                                                                t.data("amountofsets", amountofsets.toString());
                                                                t.data("amountofkeys", n);
                                                                t.send((ERR, STATUS) => {
                                                                    if (ERR) {
                                                                        client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                                    } else {
                                                                        client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                                        console.log("## Trade offer sent!");
                                                                    }
                                                                });
                                                            }
                                                        } else {
                                                            console.log("## An error occurred while getting bot sets: " + ERR);
                                                        }
                                                    });
                                                } else {
                                                    console.log("## An error occurred while getting user inventory: " + ERR);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Please try a lower amount of keys.");
                    }
                } else {
                    client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                }
            } else {
                client.chatMessage(SENDER, "Please try again later.");
            }
            break;

        // Check
        case "CHECK":
            var n = parseInt(command[1]);
            if (!isNaN(n) && parseInt(n) > 0) {
                let s = "";
                if (n > 1)
                    s = "(s)";
                client.chatMessage(SENDER, "\nThe current prices are:" +
                    "\r\nWith " + n + " CS:GO Key" + s + " you can get " + n * config.CARDS.CSGO.buy_sets_by_one + " Sets." +
                    "\r\nWith " + n + " TF2 Key" + s + " you can get " + n * config.CARDS.TF2.buy_sets_by_one + " Sets." +
                    "\r\nWith " + n + " PUBG Key" + s + " you can get " + n * config.CARDS.PUBG.buy_sets_by_one + " Sets." +
                    "\r\nWith " + n * config.CARDS.GEMS.buy_one_set_for + " Gems you can get " + n + " Set" + s + "" +
                    "\r\n" +
                    "\r\nAlso, we're buying sets:" +
                    "\r\nFor " + n * config.CARDS.CSGO.give_one_for + " Sets you can get " + n + " CSGO Key" + s + "." +
                    "\r\nFor " + n * config.CARDS.TF2.give_one_for + " Sets you can get " + n + " TF2 Key" + s + "." +
                    "\r\nFor " + n * config.CARDS.PUBG.give_one_for + " Sets you can get " + n + " PUBG Key" + s + "." +
                    "\r\nFor " + n + " Set" + s + " you can get " + n * config.CARDS.GEMS.give_one_set_for + " Gems"
                );
            } else {
                if (Object.keys(botSets).length > 0) {
                    client.chatMessage(SENDER, "Loading badges...");
                    Utils.getBadges(SENDER.getSteamID64(), (ERR, DATA) => {
                        if (!ERR) {
                            let b = {}; // List with badges that CAN still be crafted
                            if (DATA) {
                                for (let i = 0; i < Object.keys(DATA).length; i++) {
                                    if (DATA[Object.keys(DATA)[i]] < 6) {
                                        b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                    }
                                }
                            } else {
                                client.chatMessage(SENDER.getSteamID64(), "Your badges are empty, sending an offer without checking badges.");
                            }
                            // console.log(b);
                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                            // 1: GET BOTS CARDS. DONE
                            // 2: GET PLAYER's BADGES. DONE
                            // 3: MAGIC
                            let hisMaxSets = 0,
                                botNSets = 0;
                            // Loop for sets he has partially completed
                            for (let i = 0; i < Object.keys(b).length; i++) {
                                if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                    hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                }
                            }
                            // Loop for sets he has never crafted
                            for (let i = 0; i < Object.keys(botSets).length; i++) {
                                if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                    if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                        hisMaxSets += 5;
                                    } else {
                                        hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                    }
                                }
                                botNSets += botSets[Object.keys(botSets)[i]].length;
                            }
                            totalBotSets = botNSets;
                            let playThis = config.PLAYGAMES;
                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                playThis[0] = parseString(playThis[0], totalBotSets);
                            }
                            client.gamesPlayed(playThis);
                            client.chatMessage(SENDER, "There are currently " + hisMaxSets + "/" + botNSets + " sets available which you have not fully crafted yet." +
                                "Buying all of them will cost you:" +
                                "\r\n" + parseInt(hisMaxSets / config.CARDS.CSGO.buy_sets_by_one * 100) / 100 + " CSGO Key(s) or" +
                                "\r\n" + parseInt(hisMaxSets / config.CARDS.TF2.buy_sets_by_one * 100) / 100 + " TF2 Key(s) or" +
                                "\r\n" + parseInt(hisMaxSets / config.CARDS.PUBG.buy_sets_by_one * 100) / 100 + " PUBG Key(s) or" +
                                "\r\n" + parseInt(hisMaxSets * config.CARDS.GEMS.buy_one_set_for * 100) / 100 + " Gems.");
                        } else {
                            client.chatMessage(SENDER, "An error occurred while getting your badges. Please try again.");
                            console.log("An error occurred while getting badges: " + ERR);
                        }
                    });
                } else {
                    client.chatMessage(SENDER, "Please try again later.");
                }
            }
            break;
        case "SELLCHECK":
            var n = parseInt(command[1]);
            client.chatMessage(SENDER, "Loading inventory...");
            Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                console.log("DEBUG#INVLOADED");
                if (!ERR) {
                    let s = DATA;
                    Utils.getSets(s, allCards, (ERR, DATA) => {
                        console.log("DEBUG#SETSLOADED");
                        if (!ERR) {
                            // console.log(b);
                            // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                            // 1: GET BOTS CARDS. DONE
                            // 2: GET PLAYER's BADGES. DONE
                            // 3: MAGIC
                            let hisMaxSets = 0,
                                botNSets = 0;
                            // Loop for sets he has partially completed
                            // Loop for sets he has never crafted
                            for (let i = 0; i < Object.keys(DATA).length; i++) {
                                if (DATA[Object.keys(DATA)[i]].length >= 5) {
                                    hisMaxSets += 5;
                                } else {
                                    hisMaxSets += DATA[Object.keys(DATA)[i]].length;
                                }
                                botNSets += DATA[Object.keys(DATA)[i]].length;
                            }
                            totalBotSets = botNSets;
                            let playThis = config.PLAYGAMES;
                            if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                playThis[0] = parseString(playThis[0], totalBotSets);
                            }
                            if (botNSets === 0) {
                                client.chatMessage(SENDER, "You currently don't have any available set which the bot can buy.");
                            }
                            else {
                                client.gamesPlayed(playThis);
                                client.chatMessage(SENDER, "You currently have " + botNSets + " set(s) available which the bot can buy. " +
                                    "\r\nFor all of them the bot will pay you:" +
                                    "\r\n" + parseInt(botNSets / config.CARDS.CSGO.give_one_for * 100) / 100 + " CSGO Key(s) or" +
                                    "\r\n" + parseInt(botNSets / config.CARDS.TF2.give_one_for * 100) / 100 + " TF2 Key(s) or" +
                                    "\r\n" + parseInt(botNSets / config.CARDS.PUBG.give_one_for * 100) / 100 + " PUBG Key(s) or" +
                                    "\r\n" + parseInt(botNSets * config.CARDS.GEMS.give_one_set_for * 100) / 100 + " Gems."
                                );
                            }
                        } else {
                            console.log("## An error occurred while getting user sets: " + ERR);
                        }
                    });
                } else {
                    console.log("## An error occurred while getting user inventory: " + ERR);
                }
            });
            break;

        // Games
        case "BUYGAME":
            var n = parseInt(command[1]);
            if (!isNaN(n) && parseInt(n) > 0) {
                let gamesStock = jsonfile.readFileSync(gamesstockfilename);
                let length = Object.keys(gamesStock.stock).length;
                if (length > 0) {
                    let stock = gamesStock.stock;
                    if (typeof stock[n] !== 'undefined') {
                        client.chatMessage(SENDER, "You're going to buy game \"" + stock[n].name + "\" for " + stock[n].price + " Key(s).\r\nProcessing your request...");
                        let t = manager.createOffer(SENDER.getSteamID64());
                        t.getUserDetails((ERR, ME, THEM) => {
                            let price = stock[n].price;
                            if (ERR) {
                                console.log("## An error occurred while getting trade holds: " + ERR);
                                client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                let theirKeys = [];
                                manager.getUserInventoryContents(SENDER.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                    if (ERR) {
                                        console.log("## An error occurred while getting inventory: " + ERR);
                                        client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                    } else {
                                        console.log("DEBUG#INV LOADED");
                                        if (!ERR) {
                                            console.log("DEBUG#INV LOADED NOERR");
                                            for (let i = 0; i < INV.length; i++) {
                                                if (theirKeys.length < price && config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length !== price) {
                                                client.chatMessage(SENDER, "You do not have enough keys.");
                                            } else {
                                                console.log("DEBUG#SENDING");
                                                t.addTheirItems(theirKeys);
                                                t.data("commandused", "BuyGame");
                                                t.setMessage("After you confirm trade, I will send you Steam CD Key to chat!");
                                                t.data("index", n);
                                                t.send((ERR, STATUS) => {
                                                    if (ERR) {
                                                        client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                        console.log("## An error occurred while sending trade: " + ERR);
                                                    } else {
                                                        client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                        console.log("## Trade offer sent");
                                                        client.chatMessage(SENDER, "After you confirm trade, I will send you Steam CD Key to this chat!");
                                                        client.chatMessage(SENDER, "Don't close me!");
                                                    }
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    } else {
                        client.chatMessage(SENDER, "Game with this AppID doesn't exists. Check available games by !checkgames command");
                    }
                } else {
                    client.chatMessage(SENDER, "We have currently don't have games in stock. Try again later...");
                }
            } else {
                client.chatMessage(SENDER, "Please provide a valid game Index.");
            }
            break;
        case "CHECKGAMES":
            let gamesStock = jsonfile.readFileSync(gamesstockfilename);
            let gamesstring = "";
            let length = Object.keys(gamesStock.stock).length;
            if (length > 0) {
                for (let i = 0; i < length; i++) {
                    let j = Object.keys(gamesStock.stock)[i];
                    if (gamesStock.stock[j].keys.length > 0)
                        gamesstring += "[" + j + "] " + gamesStock.stock[j].name + " | Stock: " + gamesStock.stock[j].keys.length + " | Price: " + gamesStock.stock[j].price + " Key(s)\r\n";
                }
                client.chatMessage(SENDER, "\nWe have these games in stock:\r\n\n" +
                    gamesstring +
                    "\n!buygame [AppID] - Buy game with given AppID according to list upper."
                );
            } else {
                client.chatMessage(SENDER, "\nWe have currently don't have games in stock. Try again later...");
            }
            break;

        // Other
        case "OWNER":
            client.chatMessage(SENDER, "My steam account: \r\n" + config.OWNERLINK);
            break;
        case "CREDITS":
            client.chatMessage(SENDER, config.CREDITS);
            break;

        // For steambadges bot
        case "CP":
            client.chatMessage(SENDER, "Current price " + config.CARDS.CSGO.buy_sets_by_one);
            break;
        case "CG":
            client.chatMessage(SENDER, "Current gems " + config.CARDS.GEMS.buy_one_set_for);
            break;

        // When command not recognized
        default:
            if (isAdmin) {
                switch (command[0]) {
                    // Admin commands.
                    case "ADMIN":
                        client.chatMessage(SENDER, "List of admin commands:\n" +
                            "!withdraw - withdraw x amount of CS:GO keys\n" +
                            "!tfwithdraw - withdraw x amount of TFkeys\n" +
                            "!gemswithdraw - withdraw x amount of Gems\n" +
                            "!deposit - deposit x amount of CS:GO keys\n" +
                            "!tfdeposit - deposit x amount of TF keys\n" +
                            "!gemsdeposit - deposit x amount of Gems\n" +
                            "!shutdown - logoff bot account and close application\n" +
                            "!restart - logoff and login account\n" +
                            "!block - block desired steam user\n" +
                            "!unblock - unblock desired steam user\n" +
                            "!stock - send a trade offer to owner requesting all available sets to trade\n" +
                            "!profit - show information about bot sells/buy");
                        break;
                    case "GEMSWITHDRAW":
                        var amountgems = parseInt(command[1]);
                        if (!isNaN(amountgems) && parseInt(amountgems) > 0) {
                            manager.getInventoryContents(config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                if (ERR) {
                                    client.chatMessage(SENDER, "An error occurred while loading the bot's inventory.");
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                } else {
                                    let botgems = 0;
                                    let t = manager.createOffer(SENDER.getSteamID64());
                                    for (let i = 0; i < INV.length; i++) {
                                        if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                            botgems = INV[i].amount;
                                            if (INV[i].amount >= amountgems) {
                                                INV[i].amount = amountgems;
                                                t.addMyItem(INV[i]);
                                                break;
                                            }
                                        }
                                    }
                                    if (botgems < amountgems)
                                        client.chatMessage(SENDER, "Bot don't have enough gems to send. (He has " + botgems + " gems)");
                                    else {
                                        t.data("adminaction", 1);
                                        t.send();
                                        client.chatMessage(SENDER, amountgems + " gems sent to your account.");
                                    }
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of gems!");
                        }
                        break;
                    case "TFWITHDRAW":
                        var amountkeys = parseInt(command[1]);
                        if (!isNaN(amountkeys) && parseInt(amountkeys) > 0) {
                            manager.getInventoryContents(config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                if (ERR) {
                                    client.chatMessage(SENDER, "An error occurred while loading the bot's inventory.");
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                } else {
                                    let botkeys = 0;
                                    let t = manager.createOffer(SENDER.getSteamID64());
                                    let added = 0;
                                    for (let i = 0; i < INV.length; i++) {
                                        if (config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                            botkeys++;
                                            if (added < amountkeys) {
                                                t.addMyItem(INV[i]);
                                                added++;
                                            }
                                        }
                                    }
                                    if (botkeys < amountkeys)
                                        client.chatMessage(SENDER, "Bot don't have enough keys to send. (He has " + botkeys + " keys)");
                                    else {
                                        t.data("adminaction", 1);
                                        t.send();
                                        client.chatMessage(SENDER, amountkeys + " keys sent to your account.");
                                    }
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                        }
                        break;
                    case "WITHDRAW":
                        var amountkeys = parseInt(command[1]);
                        if (!isNaN(amountkeys) && parseInt(amountkeys) > 0) {
                            manager.getInventoryContents(config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                if (ERR) {
                                    client.chatMessage(SENDER, "An error occurred while loading the bot's inventory.");
                                    console.log("## An error occurred while getting inventory: " + ERR);
                                } else {
                                    let botkeys = 0;
                                    let t = manager.createOffer(SENDER.getSteamID64());
                                    let added = 0;
                                    for (let i = 0; i < INV.length; i++) {
                                        if (config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                            botkeys++;
                                            if (added < amountkeys) {
                                                t.addMyItem(INV[i]);
                                                added++;
                                            }
                                        }
                                    }
                                    if (botkeys < amountkeys)
                                        client.chatMessage(SENDER, "Bot don't have enough keys to send. (He has " + botkeys + " keys)");
                                    else {
                                        t.data("adminaction", 1);
                                        t.send();
                                        client.chatMessage(SENDER, amountkeys + " keys sent to your account.");
                                    }
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                        }
                        break;
                    case "GEMSDEPOSIT":
                        var amountgems = parseInt(command[1]);
                        if (!isNaN(amountgems) && parseInt(amountgems) > 0) {
                            let t = manager.createOffer(SENDER.getSteamID64());
                            t.getUserDetails((ERR, ME, THEM) => {
                                if (ERR) {
                                    console.log("## An error occurred while getting trade holds: " + ERR);
                                    client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                                } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                    let theirKeys = [];
                                    client.chatMessage(SENDER, "Processing your request.");
                                    manager.getUserInventoryContents(SENDER.getSteamID64(), config.STEAMGAME, 6, true, (ERR, INV, CURR) => {
                                        if (ERR) {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                        } else {
                                            let theirKeys = [];
                                            let botgems = 0;
                                            for (let i = 0; i < INV.length; i++) {
                                                if (config.STEAMGEMS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    botgems = INV[i].amount;
                                                    if (INV[i].amount >= amountgems) {
                                                        INV[i].amount = amountgems;
                                                        t.addTheirItem(INV[i]);
                                                        break;
                                                    }
                                                }
                                            }
                                            if (botgems < amountgems) {
                                                client.chatMessage(SENDER, "You don't have enough gems to send. (You have " + botgems + " gems)");
                                            } else {
                                                t.data("adminaction", 1);
                                                t.send();
                                                client.chatMessage(SENDER, "You sent me " + amountgems + " gems.");
                                            }
                                        }
                                    });
                                } else {
                                    client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                        }
                        break;
                    case "TFDEPOSIT":
                        var amountkeys = parseInt(command[1]);
                        if (!isNaN(amountkeys) && parseInt(amountkeys) > 0) {
                            let t = manager.createOffer(SENDER.getSteamID64());
                            t.getUserDetails((ERR, ME, THEM) => {
                                if (ERR) {
                                    console.log("## An error occurred while getting trade holds: " + ERR);
                                    client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                                } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                    let theirKeys = [];
                                    client.chatMessage(SENDER, "Processing your request.");
                                    manager.getUserInventoryContents(SENDER.getSteamID64(), config.TFGAME, 2, true, (ERR, INV, CURR) => {
                                        if (ERR) {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                        } else {
                                            let theirKeys = [];
                                            for (let i = 0; i < INV.length; i++) {
                                                if (config.TFACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length < amountkeys) {
                                                client.chatMessage(SENDER, "You don't have enough keys to send. (You have " + theirKeys.length + " keys)");
                                            } else {
                                                t.addTheirItems(theirKeys);
                                                t.data("adminaction", 1);
                                                t.send();
                                                client.chatMessage(SENDER, "You sent me " + amountkeys + " keys.");
                                            }
                                        }
                                    });
                                } else {
                                    client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                        }
                        break;
                    case "DEPOSIT":
                        var amountkeys = parseInt(command[1]);
                        if (!isNaN(amountkeys) && parseInt(amountkeys) > 0) {
                            let t = manager.createOffer(SENDER.getSteamID64());
                            t.getUserDetails((ERR, ME, THEM) => {
                                if (ERR) {
                                    console.log("## An error occurred while getting trade holds: " + ERR);
                                    client.chatMessage(SENDER, "An error occurred while getting your trade holds. Please try again");
                                } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                                    let theirKeys = [];
                                    client.chatMessage(SENDER, "Processing your request.");
                                    manager.getUserInventoryContents(SENDER.getSteamID64(), config.CSGOGAME, 2, true, (ERR, INV, CURR) => {
                                        if (ERR) {
                                            console.log("## An error occurred while getting inventory: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while loading your inventory. Please try later");
                                        } else {
                                            let theirKeys = [];
                                            for (let i = 0; i < INV.length; i++) {
                                                if (config.ACCEPTEDKEYS.indexOf(INV[i].market_hash_name) >= 0) {
                                                    theirKeys.push(INV[i]);
                                                }
                                            }
                                            if (theirKeys.length < amountkeys) {
                                                client.chatMessage(SENDER, "You don't have enough keys to send. (You have " + theirKeys.length + " keys)");
                                            } else {
                                                t.addTheirItems(theirKeys);
                                                t.data("adminaction", 1);
                                                t.send();
                                                client.chatMessage(SENDER, "You sent me " + amountkeys + " keys.");
                                            }
                                        }
                                    });
                                } else {
                                    client.chatMessage(SENDER, "Please make sure you don't have a trade hold!");
                                }
                            });
                        } else {
                            client.chatMessage(SENDER, "Please enter a valid amount of keys!");
                        }
                        break;
                    case "SHUTDOWN":
                        client.chatMessage(SENDER, "GoodBye!");
                        client.logOff();
                        process.exit(69)
                        break;
                    case "RESTART":
                        client.chatMessage(SENDER, "Relogging!");
                        client.relog();
                        break;
                    case "BLOCK":
                        var n = command[1].toString();
                        if (SID64REGEX.test(n)) {
                            client.chatMessage(SENDER, "User blocked.");
                            client.blockUser(n);
                        } else {
                            client.chatMessage(SENDER, "Please provide a valid SteamID64");
                        }
                        break;
                    case "UNBLOCK":
                        var n = command[1].toString();
                        if (SID64REGEX.test(n)) {
                            client.chatMessage(SENDER, "User unblocked.");
                            client.unblockUser(n);
                        } else {
                            client.chatMessage(SENDER, "Please provide a valid SteamID64");
                        }
                        break;
                    case "USERCHECK":
                        var n = command[1].toString();
                        if (SID64REGEX.test(n)) {
                            if (Object.keys(botSets).length > 0) {
                                client.chatMessage(SENDER, "Loading badges...");
                                Utils.getBadges(n, (ERR, DATA) => {
                                    if (!ERR) {
                                        let b = {}; // List with badges that CAN still be crafted
                                        if (DATA) {
                                            for (let i = 0; i < Object.keys(DATA).length; i++) {
                                                if (DATA[Object.keys(DATA)[i]] < 6) {
                                                    b[Object.keys(DATA)[i]] = 5 - DATA[Object.keys(DATA)[i]];
                                                }
                                            }
                                        } else {
                                            client.chatMessage(SENDER.getSteamID64(), n + "'s badges are empty, sending an offer without checking badges.");
                                        }
                                        console.log(b);
                                        // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                        // 1: GET BOTS CARDS. DONE
                                        // 2: GET PLAYER's BADGES. DONE
                                        // 3: MAGIC
                                        let hisMaxSets = 0,
                                            botNSets = 0;
                                        // Loop for sets he has partially completed
                                        for (let i = 0; i < Object.keys(b).length; i++) {
                                            if (botSets[Object.keys(b)[i]] && botSets[Object.keys(b)[i]].length >= 5 - b[Object.keys(b)[i]].length) {
                                                hisMaxSets += 5 - b[Object.keys(b)[i]].length;
                                            }
                                        }
                                        // Loop for sets he has never crafted
                                        for (let i = 0; i < Object.keys(botSets).length; i++) {
                                            if (Object.keys(b).indexOf(Object.keys(botSets)[i]) < 0) {
                                                if (botSets[Object.keys(botSets)[i]].length >= 5) {
                                                    hisMaxSets += 5;
                                                } else {
                                                    hisMaxSets += botSets[Object.keys(botSets)[i]].length;
                                                }
                                            }
                                            botNSets += botSets[Object.keys(botSets)[i]].length;
                                        }
                                        client.chatMessage(SENDER, "There are currently " + hisMaxSets + "/" + botNSets + " sets available which " + n + " has not fully crafted yet. Buying all of them will cost " + parseInt(hisMaxSets / config.CARDS.CSGO.BUY1FORAMOUNTOFSETS * 100) / 100 + " keys.");
                                    } else {
                                        client.chatMessage(SENDER, "An error occurred while getting " + n + "'s badges. Please try again.");
                                        console.log("An error occurred while getting badges: " + ERR);
                                    }
                                });
                            } else {
                                client.chatMessage(SENDER, "Please try again later.");
                            }
                        } else {
                            client.chatMessage(SENDER, "Please provide a valid SteamID64.");
                        }
                        break;
                    case "STOCK":
                        client.chatMessage(SENDER, "Loading inventory...");
                        Utils.getInventory(SENDER.getSteamID64(), community, (ERR, DATA) => {
                            console.log("DEBUG#INVLOADED");
                            if (!ERR) {
                                let s = DATA;
                                Utils.getSets(s, allCards, (ERR, DATA) => {
                                    console.log("DEBUG#SETSLOADED");
                                    if (!ERR) {
                                        // console.log(b);
                                        // TODO: COUNT AMOUNT OF SETS BOT CAN GIVE HIM
                                        // 1: GET BOTS CARDS. DONE
                                        // 2: GET PLAYER's BADGES. DONE
                                        // 2: GET PLAYER's BADGES. DONE
                                        // 3: MAGIC
                                        let hisMaxSets = 0,
                                            botNSets = 0;
                                        // Loop for sets he has partially completed
                                        // Loop for sets he has never crafted
                                        for (let i = 0; i < Object.keys(DATA).length; i++) {
                                            if (DATA[Object.keys(DATA)[i]].length >= 5) {
                                                hisMaxSets += 5;
                                            } else {
                                                hisMaxSets += DATA[Object.keys(DATA)[i]].length;
                                            }
                                            botNSets += DATA[Object.keys(DATA)[i]].length;
                                        }
                                        totalBotSets = botNSets;
                                        let playThis = config.PLAYGAMES;
                                        if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                                            playThis[0] = parseString(playThis[0], totalBotSets);
                                        }
                                        if (botNSets === 0) {
                                            client.chatMessage(SENDER, "You currently don't have any available set which the bot can stock.");
                                        }
                                        else {
                                            client.gamesPlayed(playThis);
                                            client.chatMessage(SENDER, "You currently have " + botNSets + " set(s) available which the bot can stock.\r\nSending offer...");
                                            let t = manager.createOffer(SENDER.getSteamID64());
                                            Utils.getSets(s, allCards, (ERR, DDATA) => {
                                                if (!ERR) {
                                                    sortSetsByAmountB(s, (DATA) => {
                                                        let setsSent = {};
                                                        firsttLoop: for (let i = 0; i < DATA.length; i++) {
                                                            console.log(setsSent);
                                                            console.log(DATA[i]);
                                                            if (DDATA[DATA[i]]) {
                                                                for (let j = 0; j < DDATA[DATA[i]].length; j++) {
                                                                    t.addTheirItems(DDATA[DATA[i]][j]);
                                                                    console.log("DEBUG#LOOP #2 CONTINUE: ITEM ADD");
                                                                }
                                                            } else {
                                                                console.log("DEBUG#LOOP #2 CONTINUE: RETURN 2");
                                                                continue firsttLoop;
                                                            }
                                                        }
                                                    });
                                                    console.log("DEBUG#SENDING");
                                                    t.data("commandused", "Stock");
                                                    t.send((ERR, STATUS) => {
                                                        if (ERR) {
                                                            client.chatMessage(SENDER, "An error occurred while sending your trade. Steam Trades could be down. Please try again later.");
                                                            console.log("## An error occurred while sending trade: " + ERR);
                                                        } else {
                                                            client.chatMessage(SENDER, "Trade Sent! Confirming it...");
                                                            console.log("## Trade offer sent!");
                                                        }
                                                    });
                                                } else {
                                                    console.log("## An error occurred while getting bot sets: " + ERR);
                                                }
                                            });
                                        }
                                    } else {
                                        console.log("## An error occurred while getting user sets: " + ERR);
                                    }
                                });
                            } else {
                                console.log("## An error occurred while getting user inventory: " + ERR);
                            }
                        });
                        break;
                    case "ADDGAME":
                        let appid = parseInt(command[1]);
                        if (!isNaN(appid) && parseInt(appid) > 0) {
                            let key = parseInt(command[2]);
                            if (key !== "") {
                                let gamesStock = jsonfile.readFileSync(gamesstockfilename);
                                if (typeof gamesStock.stock[appid] !== 'undefined') {
                                    gamesStock.stock[appid].keys.push(key);
                                    fs.writeFile(gamesstockfilename, JSON.stringify(gamesStock, null, "\t"), function (err) {
                                        if (err) return console.log(err);
                                        client.chatMessage(SENDER, "Key successfully added to database!");
                                    });
                                } else {
                                    client.chatMessage(SENDER, "Game with this AppID is not in database. Please make it before adding key.");
                                }
                            } else
                                client.chatMessage(SENDER, "Please enter a valid key!");
                        } else
                            client.chatMessage(SENDER, "Please enter a valid AppID!");
                        break;
                    case "RESTOCK":
                        let time = parseInt(command[1]);
                        if (!restock) {
                            restock = true;
                            let playThis = config.PLAYGAMES;
                            playThis[0] = "Filling warehouse right now!";
                            client.gamesPlayed(playThis);
                            client.chatMessage(SENDER, "Restock status ENABLED!");
                        } else {
                            restock = false;
                            let playThis = config.PLAYGAMES;
                            playThis[0] =
                                totalBotSets + " Sets | " +
                                config.CARDS.CSGO.buy_sets_by_one + ":1 CS:GO | " +
                                config.CARDS.TF2.buy_sets_by_one + ":1 TF2 | " +
                                config.CARDS.GEMS.buy_one_set_for + " Gems 1 Set";
                            client.gamesPlayed(playThis);
                            client.chatMessage(SENDER, "Restock status DISABLED!");
                        }
                        break;
                    case "ADDSET":
                        let appida = parseInt(command[1]);
                        let name = command[2];
                        let setsc = command[3];

                        name = name.replace("_", " ");

                        fs.readFile("./sets.json", (ERR, DATA) => {
                            if (ERR) {
                                console.log(ERR);
                                client.chatMessage(SENDER, ERR);
                            } else {
                                let sets = JSON.parse(DATA);
                                if (typeof sets[appida] === 'undefined') {
                                    sets[appida] = {
                                        "appid": appida,
                                        "name": name,
                                        "count": setsc
                                    };
                                    fs.writeFile("./sets.json", JSON.stringify(sets), (ERR) => {
                                        if (ERR) {
                                            console.log("## An error occurred while writing sets file: " + ERR);
                                            client.chatMessage(SENDER, "An error occurred while writing sets file.");
                                        } else {
                                            client.chatMessage(SENDER, "Set added successfully.");
                                        }
                                    });
                                } else {
                                    client.chatMessage(SENDER, "This set is already in database.");
                                }
                            }
                        });
                        break;
                    default:
                        client.chatMessage(SENDER, config.MESSAGES.CMD_NOT_RECOGNIZED);
                        break;
                }
            } else {
                client.chatMessage(SENDER, config.MESSAGES.CMD_NOT_RECOGNIZED);
            }
            break;
    }
});

client.on("groupRelationship", (GROUP, REL) => {
    if (REL === 2) {
        console.log("Group invite ignored!");
        client.respondToGroupInvite(GROUP, false);
    }
});

client.on("friendRelationship", (SENDER, REL) => {
    if (REL === 2) {
        client.addFriend(SENDER);
    } else if (REL === 3) {
        if (config.INVITETOGROUPID) {
            client.inviteToGroup(SENDER, config.INVITETOGROUPID);
        }
        client.chatMessage(SENDER, config.MESSAGES.WELCOME);
    }
});

manager.on("sentOfferChanged", (OFFER, OLDSTATE) => {
    if (restock)
        return false;
    if (OFFER.state === 2) {
        client.chatMessage(OFFER.partner, "Trade confirmed! Click here to accept it: https://www.steamcommunity.com/tradeoffer/" + OFFER.id);
    } else if (OFFER.state === 3) {
        Utils.getInventory(client.steamID.getSteamID64(), community, (ERR, DATA) => {
            if (!ERR) {
                let s = DATA;
                Utils.getSets(s, allCards, (ERR, DATA) => {
                    if (!ERR) {
                        botSets = DATA;
                        console.log("## Bot's sets loaded.");
                    } else {
                        console.log("## An error occurred while getting bot sets: " + ERR);
                    }
                    let botNSets = 0;
                    for (let i = 0; i < Object.keys(botSets).length; i++) {
                        botNSets += botSets[Object.keys(botSets)[i]].length;
                    }
                    totalBotSets = botNSets;
                    let playThis = config.PLAYGAMES;
                    if (config.PLAYGAMES && typeof(config.PLAYGAMES[0]) === "string") {
                        playThis[0] = parseString(playThis[0], totalBotSets);
                    }
                    client.gamesPlayed(playThis);
                });
            } else {
                console.log("## An error occurred while getting bot inventory: " + ERR);
            }
        });
        if (config.INVITETOGROUPID) {
            client.inviteToGroup(OFFER.partner, config.INVITETOGROUPID);
        }
        let d = "" + OFFER.data("commandused") + "";
        d += "\nSets: " + OFFER.data("amountofsets");
        d += "\nKeys: " + OFFER.data("amountofkeys");
        d += "\nSteamID: " + OFFER.partner.getSteamID64();
        fs.writeFile("./TradesAccepted/" + OFFER.id + "-" + OFFER.partner.getSteamID64() + ".txt", d, (ERR) => {
            if (ERR) {
                console.log("## An error occurred while writing trade file: " + ERR);
            }
        });
        /*if(typeof OFFER.data("adminaction") !== 'undefined'){
            client.chatMessage(OFFER.partner.getSteamID64(), "Success!");
            return;
        }*/
        //IF TRADE WAS GAME GIVE PLAYER THE CODE
        if (OFFER.data("commandused") === "BuyGame") {
            let gamesStock = jsonfile.readFileSync(gamesstockfilename);
            let cdkey = gamesStock.stock[OFFER.data("index")].keys[0];
            var name = gamesStock.stock[OFFER.data("index")].name;
            gamesStock.stock[OFFER.data("index")].keys.splice(0, 1);

            fs.writeFile(gamesstockfilename, JSON.stringify(gamesStock, null, "\t"), function (err) {
                if (err) return console.log(err);
                console.log('Steam CD Key successfully removed.');
            });
            client.chatMessage(OFFER.partner.getSteamID64(), "\nYour Steam CD Key for game \"" + name + "\" is:\r\n" + cdkey);
            client.chatMessage(OFFER.partner.getSteamID64(), "\nYour Steam CD Key for game \"" + name + "\" is:\r\n" + cdkey);
            client.chatMessage(OFFER.partner.getSteamID64(), "\nYour Steam CD Key for game \"" + name + "\" is:\r\n" + cdkey);
        }
        //Add giveaway entry if user entered
        let giveawayEntry = jsonfile.readFileSync(giveawayfilename);
        if (typeof giveawayEntry.entries[OFFER.partner.getSteamID64()] !== 'undefined') {
            giveawayEntry.entries[OFFER.partner.getSteamID64()] += 1;
            fs.writeFile(giveawayfilename, JSON.stringify(giveawayEntry, null, "\t"), function (err) {
                if (err) return console.log(err);
                console.log('Giveaway entry added! (' + OFFER.partner.getSteamID64() + ')');
            });
            client.chatMessage(OFFER.partner, "New giveaway entry added!");
        }
        /////////////////////////////////////////
        community.getSteamUser(OFFER.partner, (ERR, USER) => {
            if (ERR) {
                console.log("## An error occurred while getting user profile: " + ERR);
                client.chatMessage(USER.steamID, "An error occurred while getting your profile (to comment).");
            } else {
                USER.comment(config.COMMENTAFTERTRADE, (ERR) => {
                    if (ERR) {
                        console.log("## An error occurred while commenting on user profile: " + ERR);
                        client.chatMessage(USER.steamID, "An error occurred while getting commenting on your profile.");
                    } else {
                        client.chatMessage(USER.steamID, "Thanks for trading! :D");
                    }
                });
            }
        });
    } else if (OFFER.state === 6) {
        client.chatMessage(OFFER.partner, "Hey, you did not accept the offer. Please try again if you wish to receive sets!");
    }
    /* else if (OFFER.state === 9) {
            community.checkConfirmations();
        }*/
});

manager.on("newOffer", (OFFER) => {
    if (restock)
        return false;
    if (config.ADMINS.indexOf(OFFER.partner.getSteamID64()) >= 0 || config.ADMINS.indexOf(parseInt(OFFER.partner.getSteamID64())) >= 0) {
        OFFER.getUserDetails((ERR, ME, THEM) => {
            if (ERR) {
                console.log("## An error occurred while getting trade holds: " + ERR);
                client.chatMessage(OFFER.partner, "An error occurred while getting your trade holds. Please try again");
                OFFER.decline((ERR) => {
                    if (ERR) {
                        console.log("## An error occurred while declining trade: " + ERR);
                    }
                });
            } else if (ME.escrowDays === 0 && THEM.escrowDays === 0) {
                OFFER.accept((ERR) => {
                    if (ERR) {
                        console.log("## An error occurred while declining trade: " + ERR);
                        OFFER.decline((ERR) => {
                            if (ERR) {
                                console.log("## An error occurred while declining trade: " + ERR);
                            }
                        });
                    } else {
                        client.chatMessage(OFFER.partner, "Offer accepted!");
                    }
                });
            } else {
                client.chatMessage(OFFER.partner, "Please make sure you don't have a trade hold!");
                OFFER.decline((ERR) => {
                    if (ERR) {
                        console.log("## An error occurred while declining trade: " + ERR);
                    }
                });
            }
        });
    } else if (OFFER.itemsToGive.length === 0) {
        let onlySteam = true;
        for (let i = 0; i < OFFER.itemsToReceive.length; i++) {
            if (OFFER.itemsToReceive[i].appid !== 753) {
                onlySteam = false;
            }
        }
        if (onlySteam) {
            OFFER.accept((ERR) => {
                if (ERR) {
                    console.log("## An error occurred while declining trade: " + ERR);
                }
            });
        }
    } else {
        OFFER.decline((ERR) => {
            if (ERR) {
                console.log("## An error occurred while declining trade: " + ERR);
            }
        });
    }
});

community.on("newConfirmation", (CONF) => {
    console.log("## New confirmation.");
    community.acceptConfirmationForObject(config.IDENTITYSECRET, CONF.id, (ERR) => {
        if (ERR) {
            console.log("## An error occurred while accepting confirmation: " + ERR);
        } else {
            console.log("## Confirmation accepted.");
        }
    });
});

function sortSetsByAmount(SETS, callback) {
    callback(Object.keys(SETS).sort((k1, k2) => SETS[k1].length - SETS[k2].length).reverse());
}

function sortSetsByAmountB(SETS, callback) {
    callback(Object.keys(SETS).sort((k1, k2) => SETS[k1].length - SETS[k2].length));
}

function parseString(INPUT, SETS) {
    return INPUT.replace(":sets:", SETS);
}

setInterval(function () {
    client.chatMessage("76561198374844168", "Current price " + config.CARDS.CSGO.buy_sets_by_one);
    client.chatMessage("76561198374844168", "Current gems " + config.CARDS.GEMS.buy_one_set_for);
}, 1000 * 60 * 31);

setInterval(function () {
    let botNSets = 0;
    for (let i = 0; i < Object.keys(botSets).length; i++) {
        botNSets += botSets[Object.keys(botSets)[i]].length;
    }
    totalBotSets = botNSets;
    let playThis = config.PLAYGAMES;
    playThis[0] =
        totalBotSets + " Sets | " +
        config.CARDS.CSGO.buy_sets_by_one + ":1 CS:GO | " +
        config.CARDS.TF2.buy_sets_by_one + ":1 TF2 | " +
        config.CARDS.PUBG.buy_sets_by_one + ":1 PUBG | " +
        config.CARDS.GEMS.buy_one_set_for + " Gems 1 Set";
    client.gamesPlayed(playThis);

}, 1000 * 60);