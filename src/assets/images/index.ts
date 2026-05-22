import catBatteryPackAsset from './cat_battery_pack_1779248627109.png';
import catMotorPistonAsset from './cat_motor_piston_1779248613015.png';
import catSmartControllerAsset from './cat_smart_controller_1779248641029.png';
import catWaterproofCaseAsset from './cat_waterproof_case_1779248659640.png';
import droneAccessoriesAsset from './drone_accessories_1779242901515.png';
import mavic3ProAsset from './mavic_3_pro_1779242859141.png';
import mini4ProAsset from './mini_4_pro_1779242880924.png';

// In Next.js, static image imports return an object with metadata.
// The current storefront components use native <img> and CSS backgroundImage,
// so they need the resolved URL string rather than the full StaticImageData object.
const catBatteryPackImage = catBatteryPackAsset.src;
const catMotorPistonImage = catMotorPistonAsset.src;
const catSmartControllerImage = catSmartControllerAsset.src;
const catWaterproofCaseImage = catWaterproofCaseAsset.src;
const droneAccessoriesImage = droneAccessoriesAsset.src;
const mavic3ProImage = mavic3ProAsset.src;
const mini4ProImage = mini4ProAsset.src;

export {
  catBatteryPackImage,
  catMotorPistonImage,
  catSmartControllerImage,
  catWaterproofCaseImage,
  droneAccessoriesImage,
  mavic3ProImage,
  mini4ProImage,
};
