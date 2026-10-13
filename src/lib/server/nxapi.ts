import 'dotenv/config';
import { addUserAgent, setClientAuthentication } from 'nxapi';
import pkg from '../../../package.json';

addUserAgent(`benlawrenceReef/${pkg.version} (+ben@reefpresence.app)`);
setClientAuthentication({
	id: process.env.NXAPI_ZNCA_API_CLIENT_ID ?? '',
	secret: process.env.NXAPI_ZNCA_API_CLIENT_SECRET,
	scope: 'ca:gf ca:er ca:dr'
});
