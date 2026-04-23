/**
 * Node-type registry. Registering happens on import — the barrel below
 * imports every descriptor file, which calls `registerNodeType()`. Apps
 * only need to `import '@phloz/tracking-map/node-types'` once.
 */
import {
  conversionApiEndpointDescriptor,
  crmSystemDescriptor,
  customDescriptor,
  ecommercePlatformDescriptor,
  emailPlatformDescriptor,
  serverEndpointDescriptor,
} from './systems';
import { ga4DataStreamDescriptor, ga4PropertyDescriptor } from './ga4';
import {
  googleAdsAccountDescriptor,
  googleAdsConversionDescriptor,
  linkedinAdsAccountDescriptor,
  metaAdsAccountDescriptor,
  metaCapiDescriptor,
  metaPixelDescriptor,
  microsoftAdsAccountDescriptor,
  tiktokAdsAccountDescriptor,
  tiktokPixelDescriptor,
} from './ads';
import { gtmContainerDescriptor, gtmServerContainerDescriptor } from './gtm';
import { landingPageDescriptor, websiteDescriptor } from './pages';
import { registerNodeType } from './registry';

// Register in a stable order — analytics first, then tag managers, then
// paid-media, server, commerce, email, crm, pages, custom.
registerNodeType(ga4PropertyDescriptor);
registerNodeType(ga4DataStreamDescriptor);
registerNodeType(gtmContainerDescriptor);
registerNodeType(gtmServerContainerDescriptor);
registerNodeType(googleAdsAccountDescriptor);
registerNodeType(googleAdsConversionDescriptor);
registerNodeType(metaAdsAccountDescriptor);
registerNodeType(metaPixelDescriptor);
registerNodeType(metaCapiDescriptor);
registerNodeType(tiktokAdsAccountDescriptor);
registerNodeType(tiktokPixelDescriptor);
registerNodeType(microsoftAdsAccountDescriptor);
registerNodeType(linkedinAdsAccountDescriptor);
registerNodeType(websiteDescriptor);
registerNodeType(landingPageDescriptor);
registerNodeType(crmSystemDescriptor);
registerNodeType(emailPlatformDescriptor);
registerNodeType(ecommercePlatformDescriptor);
registerNodeType(serverEndpointDescriptor);
registerNodeType(conversionApiEndpointDescriptor);
registerNodeType(customDescriptor);

export * from './registry';
export * from './ga4';
export * from './gtm';
export * from './ads';
export * from './pages';
export * from './systems';
