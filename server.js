const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

/* TUYA CONFIG */
const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

const TUYA_URL = "https://openapi.tuyaeu.com";

/* SHELLY */
const SHELLY_IP = "192.168.2.122";

/* TOKEN */
let ACCESS_TOKEN = "";

async function getToken(){

  const t = Date.now().toString();
  const signStr = CLIENT_ID + t;

  const sign = crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(signStr)
    .digest("hex")
    .toUpperCase();

  const res = await axios.get(`${TUYA_URL}/v1.0/token?grant_type=1`,{
    headers:{
      client_id:CLIENT_ID,
      sign,
      t,
      sign_method:"HMAC-SHA256"
    }
  });

  ACCESS_TOKEN = res.data.result.access_token;
}

/* TUYA DATA */
async function getPool(){

  const t = Date.now().toString();

  const signStr = CLIENT_ID + ACCESS_TOKEN + t;

  const sign = crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(signStr)
    .digest("hex")
    .toUpperCase();

  const res = await axios.get(
    `${TUYA_URL}/v1.0/iot-03/devices/${DEVICE_ID}/status`,
    {
      headers:{
        client_id:CLIENT_ID,
        access_token:ACCESS_TOKEN,
        sign,
        t,
        sign_method:"HMAC-SHA256"
      }
    }
  );

  const props = res.data.result;

  let temp = 0;
  let ph = 0;
  let orp = 0;

  props.forEach(p =>{

    if(p.code==="temp_current") temp = p.value/10;
    if(p.code==="ph_current") ph = p.value/100;
    if(p.code==="orp_current") orp = p.value;

  });

  return {temp,ph,orp};

}

/* SHELLY */
async function getShelly(){

  try{

    const res = await axios.get(`http://${SHELLY_IP}/rpc/Switch.GetStatus?id=0`);
    return res.data.output;

  }catch(e){
    return false;
  }

}

/* API */
app.get("/api/pool",async(req,res)=>{

  try{

    if(!ACCESS_TOKEN){
      await getToken();
    }

    const pool = await getPool();
    const pump = await getShelly();

    res.json({
      ...pool,
      pump
    });

  }catch(e){

    ACCESS_TOKEN = "";

    res.json({
      error:"tuya error"
    });

  }

});

/* DASHBOARD */
app.use(express.static("./"));

app.listen(PORT,()=>{
  console.log("Server running on port "+PORT);
});
