const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

/* TUYA */
const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

const TUYA_HOST = "https://openapi.tuyaeu.com";

/* SHELLY */
const SHELLY_IP = "192.168.2.122";

/* TOKEN */
let ACCESS_TOKEN = "";

function sign(content) {
  return crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(content)
    .digest("hex")
    .toUpperCase();
}

/* TOKEN ABRUFEN */
async function getToken() {

  const t = Date.now().toString();
  const stringToSign = CLIENT_ID + t;

  const signature = sign(stringToSign);

  const res = await axios.get(
    `${TUYA_HOST}/v1.0/token?grant_type=1`,
    {
      headers: {
        client_id: CLIENT_ID,
        sign: signature,
        t: t,
        sign_method: "HMAC-SHA256"
      }
    }
  );

  ACCESS_TOKEN = res.data.result.access_token;
}

/* POOL DATEN */
async function getPoolData() {

  const t = Date.now().toString();

  const path = `/v1.0/iot-03/devices/${DEVICE_ID}/status`;

  const stringToSign =
    CLIENT_ID +
    ACCESS_TOKEN +
    t +
    "GET\n" +
    crypto.createHash("sha256").update("").digest("hex") +
    "\n\n" +
    path;

  const signature = sign(stringToSign);

  const res = await axios.get(
    `${TUYA_HOST}${path}`,
    {
      headers: {
        client_id: CLIENT_ID,
        access_token: ACCESS_TOKEN,
        sign: signature,
        t: t,
        sign_method: "HMAC-SHA256"
      }
    }
  );

  const data = res.data.result;

  let temp = null;
  let ph = null;
  let orp = null;

  data.forEach(dp => {

    if (dp.code === "temp_current") {
      temp = dp.value / 10;
    }

    if (dp.code === "ph_current") {
      ph = dp.value / 100;
    }

    if (dp.code === "orp_current") {
      orp = dp.value;
    }

  });

  return { temp, ph, orp };

}

/* SHELLY STATUS */
async function getShelly() {

  try {

    const res = await axios.get(
      `http://${SHELLY_IP}/rpc/Switch.GetStatus?id=0`
    );

    return res.data.output;

  } catch {

    return false;

  }

}

/* API */
app.get("/api/pool", async (req, res) => {

  try {

    if (!ACCESS_TOKEN) {
      await getToken();
    }

    const pool = await getPoolData();
    const pump = await getShelly();

    res.json({
      ...pool,
      pump
    });

  } catch (err) {

    console.log(err.response?.data || err.message);

    ACCESS_TOKEN = "";

    res.json({
      error: "tuya error"
    });

  }

});

/* DASHBOARD */
app.use(express.static("./"));

app.get("/", (req, res) => {
  res.redirect("/dashboard.html");
});

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT);
});
