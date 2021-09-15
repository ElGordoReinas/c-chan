const sConfig = require('./config/serverconfig.js');
const dbManager = require('./db/dbmanager.js');
const mdbScheme = require('./db/models/mdbscheme.js');
const jsonScheme = require('./db/models/jsonscheme.js');
const sesionManager = require('./sesion/sesionmanager.js');

const utils = require('./utils.js');
const uploadManager = require('./api/upload.js');
const parser = require('./api/parser.js');
const avatar = require('./api/avatar.js');
const pass = require('./api/passport.js');
const live = require('./api/live.js');
const compat = require('./db/compat.js');
const formidable = require('express-formidable');


module.exports = function(app){
	
	//API: subida de imagenes
	app.post('/api/upload', pass.check, function(req, res) {
		let filedata = req.files.fileData;
		let mimetype = filedata.type.split("/");
		let size = filedata.size;
		if (size > sConfig.UPLOAD_MAX_SIZE){
			res.json({success: false, data: `Archivo muy grande, máximo ${utils.formatBytes(sConfig.UPLOAD_MAX_SIZE)}`});
		} else {
			if (mimetype[0] === "image"){
				uploadManager.upload(filedata, function(result){
					res.json(result);
				});
			} else if (mimetype[0] === "video"){
				uploadManager.uploadVid(filedata, function(result){
					res.json(result);
				});
			} else {
				res.json({success: false, data: "formato no admitido."});
			}
		}
	});
	
	//API: manipulacion de urls
	app.post('/api/uplink', pass.check, function(req, res) {
		let link = req.fields.link;
		uploadManager.uploadLink(link, function(result){
			res.json(result);
		});
	});
	
	//RUTA: crea un nuevo box.
	app.post('/api/new', pass.check, pass.checkBoxFields, async function(req, res) {
		let cat = req.fields.cat;
		let title = req.fields.title;
		let subtitle = req.fields.subtitle;
		let content = req.fields.content;
		let img = req.fields.img.split(";");
		let vid = req.fields.vid.split(";");
		let pollOne = req.fields.pollOne;
		let pollTwo = req.fields.pollTwo;
		
		let time = Date.now();
		let bid = utils.uuidv4();
		let json = utils.clone(jsonScheme.BOX_SCHEME);
		json.bid = bid;
		json.cat = (cat != "") ? cat : "off";
		json.user.uid = req.session.uid;
		json.date.created = time;
		json.date.bump = time;
		
		if (img[0] != ""){
			json.type.push("image");
			json.img.full = img[0];
			json.img.preview = img[1];
		} else if (vid[0] != ""){
			json.type.push("video");
			json.media.raw = vid[0];
			json.media.preview = vid[1];
		}
		
		json.content.title = title;
		json.content.body = parser.htmlSanitize(content);
		
		if (pollOne != "" && pollTwo != ""){
			json.type.push("poll");
			json.content.extra.poll = {
				pollOne: pollOne,
				pollOneV: 0,
				pollTwo: pollTwo,
				pollTwoV: 0,
				pollVotes: []
			};
		} else {
			json.content.extra.poll = {};
		}
		
		let userdata = await dbManager.queryDB(req.app.locals.db, mdbScheme.C_ADM, {uid: req.session.uid}, "", () => {});
		if (userdata[0]){
			json.user.jerarquia = {nick: userdata[0].nick, rango: userdata[0].rango, color: userdata[0].color};
		}
		dbManager.insertDB(req.app.locals.db, "boxs", json, function(){
			live.sendData("new", {kind: "newbox", data: pass.filterProtectedUID(json)});
			res.json({success: true, data: {url: "/tema/" + bid}});
		});
	});
	
	//RUTA: nuevo comentario.
	app.post('/api/com', pass.check, pass.checkComFields, async function(req, res) {
		let bid = req.fields.bid;
		let content = req.fields.content;
		let img = req.fields.img.split(";");
		let vid = req.fields.vid.split(";");
		let cid = utils.genCID(7);
		let timestamp = Date.now();
		let DB = req.app.locals.db;
		let token = req.fields.token;
		
		let json = utils.clone(jsonScheme.COMMENT_SCHEME);
		json.cid = cid;
		json.bid = bid;
		json.user.uid = req.session.uid;
		json.date.created = timestamp;
		json.icon = avatar.genAnon();
		if (img[0] != ""){
			json.type.push("image");
			json.img.full = img[0];
			json.img.preview = img[1];
		} else if (vid[0] != ""){
			json.type.push("video");
			json.media.raw = vid[0];
			json.media.preview = vid[1];
		}
		json.content.body = parser.parseComInput(DB, cid, req.session.uid, content);
		
		let userdata = sesionManager.getUserData();
		if (userdata[0]){json.user.jerarquia = {nick: userdata[0].nick, rango: userdata[0].rango, color: userdata[0].color};}
		
		//se envia la respuesta, con el comentario armado, sin importar si esta insertada en la base de datos.
		res.json({success: true, data: json});
		//el resto de acciones ocurrer luego de la respuesta al cliente.
		
		await dbManager.insertDB(DB, mdbScheme.C_COMS, json, () => {});
		let coms = await dbManager.queryDB(DB, mdbScheme.C_COMS, {bid: bid}, "", () => {});
		await dbManager.pushDB(DB, mdbScheme.C_BOXS, {bid: bid}, {$set: {"content.comments": coms.length, "date.bump": timestamp}});
		
		let box = await dbManager.queryDB(DB, mdbScheme.C_BOXS, {bid: bid}, "", () => {});
		if (box[0]){
			let op = (box[0].user.uid === req.session.uid) ? true : false;
			live.sendDataTo(bid, "comment", {token: token, op: op, data: pass.filterProtectedUID(json)});
			
			/* Notificar al dueño del box, si no es el mismo que comenta kjj */
			if (!op){
				let notifdata = utils.clone(jsonScheme.NOTIF_SCHEME);
				notifdata.sender.uid = req.session.uid;
				notifdata.receiver.uid = box[0].user.uid;
				notifdata.date.created = timestamp;
				notifdata.state.push("new");
				notifdata.content.cid = cid;
				notifdata.content.bid = bid;
				notifdata.content.preview = {
					title: box[0].content.title,
					desc: json.content.body,
					thumb: box[0].img.preview
				}
				await dbManager.insertDB(DB, mdbScheme.C_NOTIF, notifdata, function(){});
				live.sendDataTo(box[0].user.uid, "notif", pass.filterProtectedUID(notifdata));
			}
			/* fin de notificacion */
		}
		live.sendData("new", {kind: "newcom", data: pass.filterProtectedUID(json)});		
	});
	
	//MUESTRA: obtener todos los boxs, ordenados por ultimo bump y stickys
	//TODO: añadir filtro de datos
	app.get('/api/boxs', pass.check, function(req, res) {
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, "", {"date.sticky": -1, "date.bump": -1}, function(boxs){
			if (boxs[0] != undefined){			
				res.json({success: true, data: pass.filterProtectedUID(boxs)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener boxs por la categoria.
	app.get('/api/boxs/:cat', pass.check, function(req, res) {
		let cat = req.params.cat;
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, {cat: cat}, {"date.sticky": -1, "date.bump": -1}, function(boxs){
			if (boxs[0]){
				res.json({success: true, data: pass.filterProtectedUID(boxs)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener box especificado con el bid.
	app.get('/api/box/:bid', pass.check, function(req, res) {
		let bid = req.params.bid;
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, {bid: bid}, {"date.sticky": -1, "date.bump": -1}, function(boxs){
			if (boxs[0]){
				res.json({success: true, data: pass.filterProtectedUID(boxs)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//API: obtener boxs de x categoria desde un bid especifico
	app.get('/api/box/:index/:kind', pass.check, function(req, res){
		let index = req.params.index;
		let kind = req.params.kind;
		let db = req.app.locals.db;
		
		let criterio = (kind === "home") ? {} : {cat: kind};
		let orden = (kind === "home") ? {"date.sticky": -1, "date.bump": -1} : {"date.sticky": -1, "date.csticky": -1, "date.bump": -1};
		
		dbManager.queryDB(db, mdbScheme.C_BOXS, criterio, orden, function(boxs){
			if (boxs[0]){
				let indice = 0;
				for (var i=0; i<boxs.length; i++){
					if (boxs[i].bid === index){
						indice = i;
						break;
					}
				}
				let desde = indice+1;
				let hasta = 20; //numero de boxs a cargar.
				dbManager.queryDBSkip(db, mdbScheme.C_BOXS, criterio, orden, desde, hasta, function(limitBoxs){
					if (limitBoxs[0]){	
						res.json({success: true, data: pass.filterProtectedUID(limitBoxs)});
					} else {
						res.json({success: false, data: null});
					}
				});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//API: controla y redirige las notificaciones
	app.get('/api/ntf/:bid/:cid', async function(req, res) {
		let bid = req.params.bid;
		let cid = req.params.cid;
		let uid = req.session.uid;
		//limpiar notificaciones
		await dbManager.deleteDB(req.app.locals.db, mdbScheme.C_NOTIF, {"receiver.uid": uid, "content.bid": bid, "content.tag": false}, ()=>{});
		await dbManager.deleteDB(req.app.locals.db, mdbScheme.C_NOTIF, {"receiver.uid": uid, "content.bid": bid, "content.cid": cid, "content.tag": true}, ()=>{});
		res.redirect("/tema/" + bid + "#" + cid);
	});
	
	//API: obtener una notificacion especificada por el timestamp, usada por el popup.
	app.get('/api/notifs/:date', function(req, res) {
		let uid = req.session.uid;
		let date = req.params.date;
		
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_NOTIF, {"receiver.uid": uid, "date.created": Number(date)}, {"date.created": -1}, function(ntf){
			if (ntf[0]){
				res.send({success: true, data: ntf[0]});
			} else {
				res.send({success: false, data: null});
			}
		});
		
	});
	
	//MUESTRA: obtener todos los comentarios
	//TODO: añadir filtro de datos
	app.get('/api/coms', pass.check, function(req, res) {
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_COMS, "", {"date.created": -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: pass.filterProtectedUID(coms)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener todos los comentarios en base al bid
	//TODO: añadir filtro de datos
	app.get('/api/coms/:bid', pass.check, function(req, res) {
		let bid = req.params.bid;
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_COMS, {bid: bid}, {"date.created": -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: pass.filterProtectedUID(coms)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener comentario especificado con el cid
	app.get('/api/com/:cid', pass.check, function(req, res) {
		let cid = req.params.cid;
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_COMS, {cid: cid}, {"date.created": -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: pass.filterProtectedUID(coms)});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
		
	//DEBUG: MUESTRA DE LA ESTRUCTURA DE LOS TEMAS EN MIKANDBV2
	//SOLO PARA DEBUG Y TEST, ESTO LO VOY A SACAR
	app.get('/dev', async function(req, res) {

		/*
		const youtube = require("./api/youtube.js");
		youtube.getVideoData("cwptTf-64Uo", function(resu){
			console.log(resu);
		});
		*/
		/*
		dbManager.insertDB(req.app.locals.db, "notifs", data, function(){
			res.redirect("/");
		});
		*/
		res.redirect("/");
	});
	
}