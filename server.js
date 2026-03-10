const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;
const DEVICE_ID = process.env.TUYA_DEVICE_ID;

const BASE_URL = "https://openapi.tuyaeu.com";

function sign(str, key) {
  return crypto.createHmac("sha256", key).update(str).digest("hex").toUpperCase();
}

async function getToken() {
  const t = Date.now().toString();
  const signStr = CLIENT_ID + t;
  const signature = sign(signStr, CLIENT_SECRET);

  const res = await axios.get(`${BASE_URL}/v1.0/token?grant_type=1`, {
    headers: {
      client_id: CLIENT_ID,
      sign: signature,
      t: t,
      sign_method: "HMAC-SHA256"
    }
  });

  return res.data.result.access_token;
}

async function getDeviceData(token) {
  const t = Date.now().toString();
  const path = `/v1.0/devices/${DEVICE_ID}/shadow/properties`;
  const signStr = CLIENT_ID + token + t + `GET\n\n\n${path}`;
  const signature = sign(signStr, CLIENT_SECRET);

  const res = await axios.get(BASE_URL + path, {
    headers: {
      client_id: CLIENT_ID,
      access_token: token,
      sign: signature,
      t: t,
      sign_method: "HMAC-SHA256"
    }
  });

  return res.data;
}

app.get("/api/pool", async (req, res) => {
  try {
    const token = await getToken();
    const data = await getDeviceData(token);

    const props = data.result.properties;

    let temperature = null;
    let ph = null;
    let orp = null;

    props.forEach(p => {
      if (p.code === "temp_current") temperature = p.value;
      if (p.code === "ph_current") ph = p.value;
      if (p.code === "orp_current") orp = p.value;
    });

    res.json({
      temperature,
      ph,
      orp
    });

  } catch (e) {
    console.log("Tuya Error:", e.response?.data || e.message);
    res.json({ error: "tuya error" });
  }
});

app.use(express.static("./"));

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
