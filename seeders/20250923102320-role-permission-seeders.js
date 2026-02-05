"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "role_permission",
      [
        {
          role_permission_id: "0b7eaa29-7444-4c3d-a97f-0d199a748009",
          access_ids: JSON.stringify({
            access: [
              {
                pageId: "51b8f024-021d-4fe6-a0f1-c09a7545dea2",
                accessPermission: [1],
              },
              {
                pageId: "a3ac0142-6440-4e2e-9ff3-80d0e24b0573",
                accessPermission: [1, 2, 3, 4, 6],
              },
              {
                pageId: "4d2b61bd-6228-47f8-bdb1-3a5102906871",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "4a586a35-10ef-41e9-bc60-e61db53d1b69",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "d6c98aa9-b746-46ee-a61e-001f5fd75d33",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "07ac38b9-7358-4e80-8fa1-80b270713a48",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "2537009c-8de3-47f1-a5f9-88cc423a7d51",
                accessPermission: [1, 2, 3, 4, 7],
              },
              {
                pageId: "e70582ab-a0d3-4d4c-8db7-1c25e7d3bc24",
                accessPermission: [1, 2, 3, 4, 8, 9],
              },
              {
                pageId: "0fff0e55-af59-4255-b3fb-a6d12959153d",
                accessPermission: [1, 2, 3, 4, 7],
              },
              {
                pageId: "62fb1f24-e5ae-44b0-8a3e-3db47cf68aa3",
                accessPermission: [1, 2, 3, 4, 6],
              },
              {
                pageId: "924ec3ba-b5bd-4ba7-89d0-a184176b88cf",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "8e3c8f14-093f-4dcd-8549-959714617eee",
                accessPermission: [1, 5, 10],
              },
              {
                pageId: "d539d0e3-dccb-476b-9d30-74a70f8ea9c7",
                accessPermission: [1, 5, 10],
              },
              {
                pageId: "b07a0c2b-77a1-42f0-af1c-ec3d8100eac0",
                accessPermission: [1, 3, 10, 5],
              },
              {
                pageId: "214dcc04-f181-4530-ab60-a656157e31ab",
                accessPermission: [1, 2, 3, 4, 10, 5],
              },
            ],
          }),
          role_id: "d8ec3751-ff2a-48fe-b54f-98e846995cbc",
        },
        {
          role_permission_id: "26b1b28a-a8a1-42ba-b208-0b2b11115929",
          access_ids: JSON.stringify({
            access: [
              {
                pageId: "51b8f024-021d-4fe6-a0f1-c09a7545dea2",
                accessPermission: [1],
              },
              {
                pageId: "2537009c-8de3-47f1-a5f9-88cc423a7d51",
                accessPermission: [1, 2, 3, 4, 7],
              },
              {
                pageId: "e70582ab-a0d3-4d4c-8db7-1c25e7d3bc24",
                accessPermission: [1, 2, 3, 4, 6, 8, 9],
              },
              {
                pageId: "a3ac0142-6440-4e2e-9ff3-80d0e24b0573",
                accessPermission: [4, 1, 2, 3, 6],
              },
              {
                pageId: "07ac38b9-7358-4e80-8fa1-80b270713a48",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "0fff0e55-af59-4255-b3fb-a6d12959153d",
                accessPermission: [1, 2, 3, 4, 7],
              },
              {
                pageId: "62fb1f24-e5ae-44b0-8a3e-3db47cf68aa3",
                accessPermission: [1, 2, 3, 4, 6],
              },
              {
                pageId: "924ec3ba-b5bd-4ba7-89d0-a184176b88cf",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "b07a0c2b-77a1-42f0-af1c-ec3d8100eac0",
                accessPermission: [1, 5, 10],
              },
              {
                pageId: "d539d0e3-dccb-476b-9d30-74a70f8ea9c7",
                accessPermission: [1, 5, 10],
              },
              {
                pageId: "8e3c8f14-093f-4dcd-8549-959714617eee",
                accessPermission: [1, 5, 10],
              },
              {
                pageId: "214dcc04-f181-4530-ab60-a656157e31ab",
                accessPermission: [1, 5, 10],
              },
            ],
          }),
          role_id: "b8c2d2bb-c922-435c-ad83-457eefe8f8e0",
        },
        {
          role_permission_id: "c5e69951-4771-47e6-83b8-a1e299681cc9",
          access_ids: JSON.stringify({
            access: [
              {
                pageId: "51b8f024-021d-4fe6-a0f1-c09a7545dea2",
                accessPermission: [1],
              },
              {
                pageId: "4a586a35-10ef-41e9-bc60-e61db53d1b69",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "a3ac0142-6440-4e2e-9ff3-80d0e24b0573",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "2537009c-8de3-47f1-a5f9-88cc423a7d51",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "e70582ab-a0d3-4d4c-8db7-1c25e7d3bc24",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "0fff0e55-af59-4255-b3fb-a6d12959153d",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "62fb1f24-e5ae-44b0-8a3e-3db47cf68aa3",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "924ec3ba-b5bd-4ba7-89d0-a184176b88cf",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "8e3c8f14-093f-4dcd-8549-959714617eee",
                accessPermission: [1, 5],
              },
              {
                pageId: "d539d0e3-dccb-476b-9d30-74a70f8ea9c7",
                accessPermission: [1, 5],
              },
              {
                pageId: "b07a0c2b-77a1-42f0-af1c-ec3d8100eac0",
                accessPermission: [1, 3],
              },
              {
                pageId: "214dcc04-f181-4530-ab60-a656157e31ab",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "4d2b61bd-6228-47f8-bdb1-3a5102906871",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "d6c98aa9-b746-46ee-a61e-001f5fd75d33",
                accessPermission: [1, 2, 3, 4],
              },
              {
                pageId: "07ac38b9-7358-4e80-8fa1-80b270713a48",
                accessPermission: [1, 2, 3, 4],
              },
            ],
          }),
          role_id: "2810e291-bfcb-4336-9e60-a1ee730f44c1",
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("role_permission", null, {});
  },
};
