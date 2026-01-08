import React from 'react';
import { Button, Link, Text, Flex, Tile, hubspot } from '@hubspot/ui-extensions';

hubspot.extend(({ context, actions }) => (
  <PropertyGenerator context={context} actions={actions} />
));

const PropertyGenerator = ({ context, actions }) => {
  const generatorUrl = 'https://244637957.hs-sites-na2.com/listing-generator';

  // Get user info from HubSpot context
  const userEmail = context?.user?.email || '';
  const userName = context?.user?.firstName + ' ' + context?.user?.lastName || '';

  // URL with user params for auto-detection
  const generatorWithUser = `${generatorUrl}?email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}`;

  return (
    <Flex direction="column" gap="medium">
      <Tile>
        <Flex direction="column" gap="small">
          <Text format={{ fontWeight: 'bold' }}>
            Property Site Generator v3.2
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
        onClick={() => actions.openExternalUrl(generatorWithUser)}
        variant="secondary"
      >
        Open in New Tab
      </Button>
    </Flex>
  );
};

export default PropertyGenerator;
