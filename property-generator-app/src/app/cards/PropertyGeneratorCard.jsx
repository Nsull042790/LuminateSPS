import React from 'react';
import { Button, Text, Flex, Tile, hubspot } from '@hubspot/ui-extensions';

hubspot.extend(({ context, actions }) => (
  <PropertyGenerator context={context} actions={actions} />
));

const PropertyGenerator = ({ context, actions }) => {
  const generatorUrl = 'https://242109586.hs-sites-na2.com/listing-generator';

  // Get user info from HubSpot context - try multiple possible field names
  const userEmail = context?.user?.email || '';
  const firstName = context?.user?.firstName || context?.user?.first_name || '';
  const lastName = context?.user?.lastName || context?.user?.last_name || '';
  // Also check for a combined name field
  const fullName = context?.user?.name || context?.user?.fullName || '';
  const userName = fullName || (firstName + ' ' + lastName).trim();

  // Debug: log what we have
  console.log('HubSpot user context:', JSON.stringify(context?.user, null, 2));

  // URL with user params for auto-detection
  const generatorWithUser = `${generatorUrl}?email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}`;

  return (
    <Flex direction="column" gap="medium">
      <Tile>
        <Flex direction="column" gap="small">
          <Text format={{ fontWeight: 'bold' }}>
            Property Site Generator v8.0
          </Text>
          <Text>
            Create property listing pages with photo uploads, drag-and-drop reordering, and contact profiles.
          </Text>
          <Text variant="microcopy">
            Logged in as: {userEmail || 'Unknown'}
          </Text>
        </Flex>
      </Tile>

      <Button
        onClick={() => actions.openIframeModal({
          uri: generatorWithUser,
          height: 800,
          width: 1200,
          title: 'Property Generator'
        })}
        variant="primary"
      >
        Open Property Generator
      </Button>

      <Button
        href={{ url: generatorWithUser, external: true }}
        variant="secondary"
      >
        Open in New Tab
      </Button>
    </Flex>
  );
};

export default PropertyGenerator;
