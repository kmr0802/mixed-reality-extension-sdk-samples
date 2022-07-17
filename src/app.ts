import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import GroupMask from './group-mask';
import SolarSystem from './solar-system';
import TicTacToe from './tic-tac-toe';
import HelloWorld from './hello-world';
import WearAHat from './wear-a-hat';

export default class App {
	private wearAHat: WearAHat;
	private groupMask: GroupMask;
	private helloWorld: HelloWorld;
	private solarSystem: SolarSystem;
	private ticTacToe: TicTacToe;

	/**
	 * Constructs a new instance of this class.
	 * @param context The MRE SDK context.
	 */
	constructor(private context: MRE.Context) {
		this.groupMask = new GroupMask(context, new MRE.Vector3(8, 0.5, 5));
		this.helloWorld = new HelloWorld(context, new MRE.Vector3(2, 1, 5));
		this.solarSystem = new SolarSystem(context, new MRE.Vector3(0, 5, 0));
		this.ticTacToe = new TicTacToe(context, new MRE.Vector3(0, 0, 0));
		this.wearAHat = new WearAHat(context, new MRE.Vector3(8, 0, 2));

		// Hook the context events we're interested in.
		this.context.onStarted(() => this.started());
		this.context.onUserLeft(user => {
			this.wearAHat.userLeft(user);
		});
	}

	/**
	 * Called when a Hats application session starts up.
	 */
	private async started() {
		// Check whether code is running in a debuggable watched filesystem
		// environment and if so delay starting the app by 1 second to give
		// the debugger time to detect that the server has restarted and reconnect.
		// The delay value below is in milliseconds so 1000 is a one second delay.
		// You may need to increase the delay or be able to decrease it depending
		// on the speed of your PC.
		const delay = 1000;
		const argv = process.execArgv.join();
		const isDebug = argv.includes('inspect') || argv.includes('debug');

		// // version to use with non-async code
		// if (isDebug) {
		// 	setTimeout(this.startedImpl, delay);
		// } else {
		// 	this.startedImpl();
		// }

		// version to use with async code
		if (isDebug) {
			await new Promise(resolve => setTimeout(resolve, delay));
		}
		await this.groupMask.startedImpl();
		await this.helloWorld.startedImpl();
		await this.solarSystem.startedImpl();
		await this.ticTacToe.startedImpl();
		await this.wearAHat.startedImpl();
	}

}
