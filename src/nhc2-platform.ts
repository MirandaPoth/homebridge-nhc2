
/* There were no comments in the original file - all comments are mine */

import {
  API,
  APIEvent,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from "homebridge";
import { Device } from "nhc2-hobby-api/lib/event/device";
import { Event } from "nhc2-hobby-api/lib/event/event";
import { NHC2 } from "nhc2-hobby-api/lib/NHC2";

/*
 * PLUGIN_NAME must be the same as the 'name' in package.json
 */
const PLUGIN_NAME = "homebridge-nhc2";   
/* 
 *  PLATFORM_NAME is what goes in homebridge config.json, platforms, "name" and "platform" parameters
 * (not sure if both have to be the same) 
 */
const PLATFORM_NAME = "NHC2";

let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, NHC2Platform);
};

class NHC2Platform implements DynamicPlatformPlugin {
  private readonly Service: typeof Service = this.api.hap.Service;
  private readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  private readonly accessories: PlatformAccessory[] = [];
  private readonly nhc2: NHC2;

  constructor(
    private log: Logging,
    private config: PlatformConfig,
    private api: API,
  ) {
    this.nhc2 = new NHC2("mqtts://" + config.host, {
      port: config.port || 8884,
      clientId: config.clientId || "NHC2-homebridge",
      username: config.username || "hobby",
      password: config.password,
      rejectUnauthorized: false,
    });

    log.info("NHC2Platform finished initializing!");

    log.info("Test message typed by Miranda 13/08/2020 11:15");

    api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
      log.info("NHC2Platform 'didFinishLaunching'");

      await this.nhc2.subscribe();
      const nhc2Accessories = await this.nhc2.getAccessories();

      /* Don't need this at the moment
       *
      log.info("Listing accessories ...");
      // Get a list of all the accessories
      this.listAccessories(nhc2Accessories);
      log.info("Done listing accessories");
      *
      */

      this.addLights(nhc2Accessories);
      this.addDimmers(nhc2Accessories);
      log.info("Adding switched-generics ...");
      this.addSwitchedGeneric(nhc2Accessories);
      log.info("Done adding switched-generics");

      this.nhc2.getEvents().subscribe(event => {
        this.processEvent(event);
      });
    });
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.push(accessory);
  }

  public processEvent = (event: Event) => {
    event.Params.flatMap(param =>
      param.Devices.forEach((device: Device) => {
        const deviceAccessoryForEvent = this.findAccessoryDevice(device);
        if (!!deviceAccessoryForEvent) {
          deviceAccessoryForEvent.services.forEach(service =>
            this.processDeviceProperties(device, service),
          );
        }
      }),
    );
  };

  private findAccessoryDevice(device: Device) {
    return this.accessories.find(accessory => accessory.UUID === device.Uuid);
  }

  // Write a list of all the accessories to the log
  private listAccessories(accessories: Device[]) {
    //const lights = accessories.filter(light => light.Model === "light");
    this.log.info("Device, Uuid, Type, Model, Properties");
    accessories.forEach(device => {
      // Let's have it in a CSV format so I can get it into Excel
      //this.log.info("Device: %s Uuid: %s Type: %s Model: %s Properties: %s", device.Name, device.Uuid, device.Type, device.Model, device.Properties);
      this.log.info("'%s','%s','%s, '%s','%s'", device.Name, device.Uuid, device.Type, device.Model, device.Properties);

/*

OK so I have these device types: 
alarms, 
alloff (3 of) 
condition (External blind action, Front door light etc) 
dimmer 
generic (Room off x 2, Kitchen lights)
heatingcooling
light
pir
simluation (Presence simulation 1),
switched-generic (Water feature switch, Gate, Open/close small garage door etc)
timeschedule
venetianblind

*/


      //const newService = new this.Service.Lightbulb(light.Name);
      //this.addStatusChangeCharacteristic(newService, newAccessory);
      //newAccessory.addService(newService);

      //this.processDeviceProperties(light, newService);

      //this.registerAccessory(newAccessory);
    });
  }

  private addLights(accessories: Device[]) {
    const lights = accessories.filter(light => light.Model === "light");
    lights.forEach(light => {
      const newAccessory = new Accessory(light.Name as string, light.Uuid);

      const newService = new this.Service.Lightbulb(light.Name);
      this.addStatusChangeCharacteristic(newService, newAccessory);
      newAccessory.addService(newService);

      this.processDeviceProperties(light, newService);

      this.registerAccessory(newAccessory);
    });
  }

  private addDimmers(accessories: Device[]) {
    const dimmers = accessories.filter(light => light.Model === "dimmer");
    dimmers.forEach(dimmer => {
      const newAccessory = new Accessory(dimmer.Name as string, dimmer.Uuid);

      const newService = new this.Service.Lightbulb(dimmer.Name);
      this.addStatusChangeCharacteristic(newService, newAccessory);
      this.addBrightnessChangeCharacteristic(newService, newAccessory);
      newAccessory.addService(newService);

      this.processDeviceProperties(dimmer, newService);

      this.registerAccessory(newAccessory);
    });
  }

  // Our gates and garage doors are 'switched-generic' devices
  private addSwitchedGeneric(accessories: Device[]) {
    const switches = accessories.filter(switched => switched.Model === "switched-generic");
    switches.forEach(switched => {
      const newAccessory = new Accessory(switched.Name as string, switched.Uuid);

      // Not sure what sort of switch it should be ...
      const newService = new this.Service.Switch(switched.Name);
      this.addStatusChangeCharacteristic(newService, newAccessory);
      newAccessory.addService(newService);

      this.processDeviceProperties(switched, newService);

      this.registerAccessory(newAccessory);
      this.log.info("Added switched-generic device %s", switched.Name);
    });
  }

  // ???
  private setState() {

  }

  private registerAccessory(accessory: PlatformAccessory) {
    const existingAccessory = this.findExistingAccessory(accessory);
    if (!!existingAccessory) {
      this.unregisterAccessory(existingAccessory);
    }

    this.accessories.push(accessory);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);
  }

  private unregisterAccessory(accessory: PlatformAccessory) {
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);
    this.accessories.splice(this.accessories.indexOf(accessory), 1);
  }

  private findExistingAccessory(newAccessory: PlatformAccessory) {
    return this.accessories
      .filter(accessory => accessory.UUID === newAccessory.UUID)
      .find(() => true);
  }

  private addStatusChangeCharacteristic(
    newService: Service,
    newAccessory: PlatformAccessory,
  ) {
    newService
      .getCharacteristic(this.Characteristic.On)
      .on(
        CharacteristicEventTypes.SET,
        (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.nhc2.sendStatusChangeCommand(
            newAccessory.UUID,
            value as boolean,
          );
          callback();
        },
      );
  }

  private addBrightnessChangeCharacteristic(
    newService: Service,
    newAccessory: PlatformAccessory,
  ) {
    newService
      .getCharacteristic(this.Characteristic.Brightness)
      .on(
        CharacteristicEventTypes.SET,
        (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.nhc2.sendBrightnessChangeCommand(
            newAccessory.UUID,
            value as number,
          );
          callback();
        },
      );
  }

  private processDeviceProperties(device: Device, service: Service) {
    if (!!device.Properties) {
      device.Properties.forEach(property => {
        this.log.info("Setting device:%s status:%s brightness:%s displayname:%s?", device.Name, property.Status, property.Brightness, service.displayName );
        if (property.Status === "On") {
          //this.log.info("Setting %s 'on'", device.Name);
          service.getCharacteristic(this.Characteristic.On).updateValue(true);
        }
        if (property.Status === "Off") {
          //this.log.info("Setting %s 'off'", device.Name);
          service.getCharacteristic(this.Characteristic.On).updateValue(false);
        }
        if (!!property.Brightness) {
          //this.log.info("Setting %s brightness to %s", device.Name, property.Brightness);
          service
            .getCharacteristic(this.Characteristic.Brightness)
            .updateValue(property.Brightness);
        }
      });
    }
  }
}
