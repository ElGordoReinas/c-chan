module.exports = {
	DBNAME: "mikandbv2",
	DBURL: process.env.MONGOURI || "mongodb://127.0.0.1:27017",
	SSL: ((process.env.SSL === "true") ? true : false) || false,
	PORT: process.env.PORT || 3000,
	SESSION_SECRET: process.env.SESSION_SECRET || "test",
	DATABASE_CACHE: ((process.env.DATABASE_CACHE === "true") ? true : false) || true,
	STATIC_CACHE_VALUE: {}, //{maxAge: 3600000*12}
	
	/* APIS EXTERNAS */
	YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
	
	/* CONFIGURACION DE SERVIDORES DE IMAGEN/VIDEO */
	UPLOAD_MAX_SIZE: 53000000, //tamaño maximo de subidas (en bytes)
	IMG_SERVER: parseInt(process.env.IMG_SERVER) || 0, //0: local, 1: imgur, 2: imgbb, 3: cloudinary
	VIDEO_SERVER: parseInt(process.env.VIDEO_SERVER) || 0, //0: local, 1: cloudinary
	IMG_LOCAL_THUMBNAIL_SIZE: 300, //300px
	IMGUR_THUMBNAIL_QUALITY: "m", //l: large m: medium, etc.
	/* CLOUDINARY */
	CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
	CLOUDINARY_THUMBNAIL_CONFIG: "/c_scale,pg_1,w_300,f_auto/",
	
	/* DELAYS ENTRE OTROS */
	COMMENT_DELAY: 5, //tiempo de espera en segundos (5 segundos)
	BOX_DELAY: 30,
	MAX_TAGS: 5 //maximo numero de tagueos permitidos.
}
