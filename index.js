#!/usr/bin/env node

'use strict';

const express = require(`express`);
const fs = require(`fs`);
const http = require(`http`);
const path = require(`path`);
const recast = require(`recast`);
const chokidar = require(`chokidar`);
const WebSocket = require('ws');

const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

app.use(express.static(`${__dirname}/viewer`));

app.get(`/model.jscad`, (req, res) => {
    fs.readFile(process.argv[2], `utf8`, (err, file) => {
        file = includeify(file)
        res.statusCode = 200;
        res.end(file);
    });
});

function includeify(script) {
    const ast = recast.parse(script);
    recast.visit(ast, {
        visitExpressionStatement: function(p) {
            if (
                p.node.expression &&
                p.node.expression.callee &&
                p.node.expression.callee.name === 'include'
            ) {
                const file = fs.readFileSync(`${path.dirname(process.argv[2])}/${p.node.expression.arguments[0].value}`, `utf8`);
                const includeAst = recast.parse(file);

                p.replace(...includeAst.program.body);
            }

            this.traverse(p);
        }
    });

    return recast.print(ast).code;
}

fs.access(process.argv[2], fs.constants.R_OK, (err) => {
    if (err) {
        console.error(`${process.argv[2]} does not exist`);
        return;
    }

    chokidar.watch(process.argv[2], {
        ignoreInitial: true
    }).on(`all`, () => {
        fs.readFile(process.argv[2], `utf8`, (err, file) => {
            file = includeify(file)
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(file);
                }
            })
        });
    });

    server.listen(3000, function () {
        console.log('Example app listening on port 3000!')
    })
});
