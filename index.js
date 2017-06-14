#!/usr/bin/env node

'use strict';

const express = require(`express`);
const fs = require(`fs`);
const http = require(`http`);
const chokidar = require(`chokidar`);
const WebSocket = require(`ws`);
const opn = require(`opn`);
const includify = require(`jscad-includify`)

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

let watchPaths = [];
let watcher;

app.use(express.static(`${__dirname}/viewer`));

app.get(`/model.jscad`, (req, res) => {
    includify.runFile(process.argv[2]).then(({code, includes}) => {
        updateWatcher(includes);
        res.statusCode = 200;
        res.end(code);
    });
});

fs.access(process.argv[2], fs.constants.R_OK, (err) => {
    if (err) {
        console.error(`${process.argv[2]} does not exist`);
        return;
    }

    watcher = chokidar.watch(process.argv[2], {
        ignoreInitial: true
    }).on(`all`, () => {
        includify.runFile(process.argv[2]).then(({code, includes}) => {
            updateWatcher(includes);

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(code);
                }
            });
        });
    });

    server.listen(3000, function () {
        opn(`http://localhost:3000`);
    })
});

function updateWatcher(newWatchPaths) {
    watcher.unwatch(watchPaths);
    watchPaths = newWatchPaths;
    watcher.add(watchPaths);
}
