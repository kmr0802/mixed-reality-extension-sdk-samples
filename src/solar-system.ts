/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk';

/**
 * Solar system database
 */
interface Database {
	[key: string]: DatabaseRecord;
}

interface DatabaseRecord {
	name: string;
	parent: string;
	diameter: number;       // km
	distance: number;       // 10^6 km
	day: number;            // hours
	year: number;           // days
	inclination: number;    // degrees
	obliquity: number;      // degrees
	retrograde: boolean;
}

interface CelestialBody {
	inclination: MRE.Actor;
	position: MRE.Actor;
	obliquity0: MRE.Actor;
	obliquity1: MRE.Actor;
	model: MRE.Actor;
}

interface CelestialBodySet {
	[key: string]: CelestialBody;
}

// Data source: https://nssdc.gsfc.nasa.gov/planetary/dataheet/
// (some settings modified for scale and dramatic effect)
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const database: Database = require('../public/solar-system/database.json');

/**
 * Solar System Application
 */
export default class SolarSystem {
	private celestialBodies: CelestialBodySet = {};
	private animationsRunning = false;
	private assets: MRE.AssetContainer;

	constructor(private context: MRE.Context, private offset: MRE.Vector3 = new MRE.Vector3(0, 0, 0)) {
		this.assets = new MRE.AssetContainer(context);
		this.offset = offset;
	}

	// use () => {} syntax here to get proper scope binding when called via setTimeout()
	// if async is required, next line becomes private startedImpl = async () => {
	public startedImpl = async () => {
		await this.createSolarSystem();

		const sunEntity = this.celestialBodies.sol;
		if (sunEntity && sunEntity.model) {
			const sun = sunEntity.model;
			sun.setBehavior(MRE.ButtonBehavior)
				.onClick(() => {
					if (this.animationsRunning) {
						this.pauseAnimations();
						this.animationsRunning = false;
					} else {
						this.resumeAnimations();
						this.animationsRunning = true;
					}
				});
		}

		this.resumeAnimations();
		this.animationsRunning = true;
	}

	private async createSolarSystem() {
		const keys = Object.keys(database);
		for (const bodyName of keys) {
			await this.createBody(bodyName);
		}
	}

	private resumeAnimations() {
		for (const anim of this.context.animations) {
			anim.play();
		}
	}

	private pauseAnimations() {
		for (const anim of this.context.animations) {
			anim.stop();
		}
	}

	// this function is "async", meaning that it returns a promise
	// (even though we don't use that promise in this sample).
	private async createBody(bodyName: string) {

		const facts = database[bodyName];

		const distanceMultiplier = Math.pow(facts.distance, 1 / 3);
		const scaleMultiplier = Math.pow(facts.diameter, 1 / 3) / 25;
		const positionValue = new MRE.Vector3(distanceMultiplier, 0, 0).add(this.offset);
		const scaleValue = { x: scaleMultiplier / 2, y: scaleMultiplier / 2, z: scaleMultiplier / 2 };
		const obliquityValue = MRE.Quaternion.RotationAxis(
			MRE.Vector3.Forward(), facts.obliquity * MRE.DegreesToRadians);
		const inclinationValue = MRE.Quaternion.RotationAxis(
			MRE.Vector3.Forward(), facts.inclination * MRE.DegreesToRadians);

		// Object layout for celestial body is:
		//  inclination                 -- orbital plane. centered on sol and tilted
		//      position                -- position of center of celestial body (orbits sol)
		//          label               -- centered above position. location of label.
		//          obliquity0          -- centered on position. hidden node to account
		//                                 for the fact that obliquity is a world-relative axis
		//              obliquity1      -- centered on position. tilt of obliquity axis
		//                  model       -- centered on position. the celestial body (rotates)
		try {
			const inclination = MRE.Actor.Create(this.context, {
				actor: {
					name: `${bodyName}-inclination`,
					transform: {
						app: { rotation: inclinationValue }
					}
				}
			});
			const position = MRE.Actor.Create(this.context, {
				actor: {
					name: `${bodyName}-position`,
					parentId: inclination.id,
					transform: {
						local: { position: positionValue }
					}
				}
			});
			const label = MRE.Actor.Create(this.context, {
				actor: {
					name: `${bodyName}-label`,
					parentId: position.id,
					transform: {
						local: { position: { y: 0.1 + Math.pow(scaleMultiplier, 1 / 2.5) } }
					}
				}
			});
			const obliquity0 = MRE.Actor.Create(this.context, {
				actor: {
					name: `${bodyName}-obliquity0`,
					parentId: position.id
				}
			});
			const obliquity1 = MRE.Actor.Create(this.context, {
				actor: {
					name: `${bodyName}-obliquity1`,
					parentId: obliquity0.id,
					transform: {
						local: { rotation: obliquityValue }
					}
				}
			});

			// load the model if it hasn't been already
			let prefab = this.assets.prefabs.find(p => p.source.uri === `solar-system/assets/${bodyName}.gltf`);
			if (!prefab) {
				const modelData = await this.assets.loadGltf(`solar-system/assets/${bodyName}.gltf`, "box");
				prefab = modelData.find(a => a.prefab !== null).prefab;
			}

			const model = MRE.Actor.CreateFromPrefab(this.context, {
				prefab: prefab,
				actor: {
					name: `${bodyName}-body`,
					parentId: obliquity1.id,
					transform: {
						local: { scale: scaleValue }
					},
					collider: {
						geometry: {
							shape: MRE.ColliderType.Sphere,
							radius: 0.5
						}
					}
				}
			});

			label.enableText({
				contents: bodyName,
				height: 0.5,
				pixelsPerLine: 50,
				color: MRE.Color3.Yellow(),
				anchor: MRE.TextAnchorLocation.TopCenter,
				justify: MRE.TextJustify.Center,
			});

			setTimeout(() => {
				label.text.color = MRE.Color3.White();
			}, 5000);

			this.celestialBodies[bodyName] = {
				inclination,
				position,
				obliquity0,
				obliquity1,
				model
			} as CelestialBody;

			this.createAnimations(bodyName);
		} catch (e) {
			MRE.log.info('app', `createBody failed ${bodyName}, ${e}`);
		}
	}

	private createAnimations(bodyName: string) {
		this.createAxialAnimation(bodyName);
		this.createOrbitalAnimation(bodyName);
	}

	public readonly timeFactor = 40;
	public readonly axialKeyframeCount = 90;
	public readonly orbitalKeyframeCount = 90;

	private createAxialAnimation(bodyName: string) {
		const facts = database[bodyName];
		const celestialBody = this.celestialBodies[bodyName];
		const axialSpinData = this.assets.animationData.find(ad => ad.name === "axialSpin") ||
			this.assets.createAnimationData("axialSpin", { tracks: [{
				target: MRE.ActorPath("target").transform.local.rotation,
				keyframes: [
					{ time: 0, value: MRE.Quaternion.Identity() },
					{ time: 0.333, value: MRE.Quaternion.FromEulerAngles(0, 0.667 * Math.PI, 0) },
					{ time: 0.667, value: MRE.Quaternion.FromEulerAngles(0, 1.333 * Math.PI, 0) },
					{ time: 1, value: MRE.Quaternion.Identity() }
				]
			}]});

		if (facts.day > 0) {
			const spin = facts.retrograde ? -1 : 1;
			// days = seconds (not in agreement with orbital animation)
			const axisTimeInSeconds = facts.day / this.timeFactor;

			// Create the animation on the actor
			axialSpinData.bind({ target: celestialBody.model }, {
				name: `${bodyName}:axial`,
				speed: spin / axisTimeInSeconds,
				wrapMode: MRE.AnimationWrapMode.Loop
			});
		}
	}

	private createOrbitalAnimation(bodyName: string) {
		const facts = database[bodyName];
		const celestialBody = this.celestialBodies[bodyName];

		if (facts.year > 0) {
			// years = seconds (not in agreement with axial animation)
			const orbitTimeInSeconds = facts.year / this.timeFactor;
			const timeStep = orbitTimeInSeconds / this.orbitalKeyframeCount;
			const angleStep = 360 / this.orbitalKeyframeCount;
			const keyframes: Array<MRE.Keyframe<MRE.Vector3>> = [];
			const initial = celestialBody.position.transform.local.position.clone();

			for (let i = 0; i < this.orbitalKeyframeCount; ++i) {
				const rotDelta = MRE.Quaternion.RotationAxis(
					MRE.Vector3.Up(), (-angleStep * i) * MRE.DegreesToRadians);
				const position = initial.rotateByQuaternionToRef(rotDelta, new MRE.Vector3());
				keyframes.push({
					time: timeStep * i,
					value: position,
				});
			}

			// Final frame
			keyframes.push({
				time: orbitTimeInSeconds,
				value: celestialBody.position.transform.local.position,
			});

			const animData = this.assets.createAnimationData(`${bodyName}:orbital`, { tracks: [{
				target: MRE.ActorPath("target").transform.local.position,
				keyframes: keyframes
			}]});

			// Create the animation on the actor
			animData.bind({ target: celestialBody.position }, { wrapMode: MRE.AnimationWrapMode.Loop });
		}
	}
}
