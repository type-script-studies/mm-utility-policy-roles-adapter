import * as D from "json-decoder";
import {
  MattermostPermissions,
  mockedPolicies,
  mockedRole,
} from "./mockData.ts";

// @mattermost types
// ----------------
type Role = {
  id: string;
  name: string;
  display_name: string;
  description: string;
  create_at: number;
  update_at: number;
  delete_at: number;
  permissions: string[];
  scheme_managed: boolean;
  built_in: boolean;
};

// private types
// -------------

// enumeration of possible values for Mapping type
enum MMPermission {
  CREATE_TEAM = "create_team",
  EDIT_OTHERS_POSTS = "edit_others_posts",
  MANAGE_INCOMING_WEBHOOKS = "manage_incoming_webhooks",
  MANAGE_OUTGOING_WEBHOOKS = "manage_outgoing_webhooks",
  MANAGE_SLASH_COMMANDS = "manage_slash_commands",
  MANAGE_OAUTH = "manage_oauth",
}

// Mapping types
// ------------

type MappingKey =
  | "enableTeamCreation"
  | "editOthersPosts"
  | "enableOnlyAdminIntegrations";

type MappingOptions = "true" | "false";
type MappingRoleName =
  | "team_user"
  | "team_admin"
  | "system_admin"
  | "system_user";

type MappingRole = {
  roleName: MappingRoleName;
  permission: MMPermission;
  shouldHave: boolean;
};

type MappingValue = {
  true: MappingRole[];
  false: MappingRole[];
};

type Mapping = {
  enableTeamCreation: MappingValue;
  editOthersPosts: MappingValue;
  enableOnlyAdminIntegrations: MappingValue;
};

type MMPermissions = {
  CREATE_TEAM: string;
  EDIT_OTHERS_POSTS: string;
  MANAGE_INCOMING_WEBHOOKS: string;
  MANAGE_OUTGOING_WEBHOOKS: string;
  MANAGE_SLASH_COMMANDS: string;
  MANAGE_OAUTH: string;
};

// Policy types
// ------------

type Policy = {
  editOthersPosts?: string;
  enableTeamCreation?: string;
  enableOnlyAdminIntegrations?: string;
};

// Role types
// ----------

type Roles = {
  system_user: Role;
  system_admin: Role;
  team_admin: Role;
  team_user: Role;
};

// Decoders, to check if JSON object is valid
// -------------------------------------------

const policyTrueDecoder = D.exactDecoder("true");
const policyFalseDecoder = D.exactDecoder("false");
const policyValueDecoder = D.oneOfDecoders(
  policyTrueDecoder,
  policyFalseDecoder,
  D.undefinedDecoder
);

const policyDecoder = D.objectDecoder<Policy>({
  editOthersPosts: policyValueDecoder,
  enableTeamCreation: policyValueDecoder,
  enableOnlyAdminIntegrations: policyValueDecoder,
});

//  Decode mattremost Permissions.
//  To check if MMPermission have the correct values
const mattermostPermissionsDecoder = D.objectDecoder<MMPermissions>({
  CREATE_TEAM: D.exactDecoder(MMPermission.CREATE_TEAM),
  EDIT_OTHERS_POSTS: D.exactDecoder(MMPermission.EDIT_OTHERS_POSTS),
  MANAGE_INCOMING_WEBHOOKS: D.exactDecoder(
    MMPermission.MANAGE_INCOMING_WEBHOOKS
  ),
  MANAGE_OUTGOING_WEBHOOKS: D.exactDecoder(
    MMPermission.MANAGE_OUTGOING_WEBHOOKS
  ),
  MANAGE_SLASH_COMMANDS: D.exactDecoder(MMPermission.MANAGE_SLASH_COMMANDS),
  MANAGE_OAUTH: D.exactDecoder(MMPermission.MANAGE_OAUTH),
});

// Check JSON valid types
// ---------------------------

// Given Policy should remove undefined properties
//
// Policy => Policy
function removeUndefinedPropertiesPolicy(policy: Policy): Policy {
  return Object.fromEntries(
    Object.entries(policy).filter(([, value]) => value !== undefined)
  );
}

// Given JSON object, should remove undefined values from decoded policies
//
// (unknown) => D.Result<Policy>
function decodePolicies(policies: unknown): D.Result<Policy> {
  return policyDecoder.decode(policies).map(removeUndefinedPropertiesPolicy);
}

// Given D.Result<Policy> should check Result.type === "Ok" and return Policy
// else show an error and return empty Policy
//
// D.Result<Policy> => Policy
function checkPolicies(policies: D.Result<Policy>): Policy {
  switch (policies.type) {
    case "OK":
      return policies.value;
    case "ERR":
      console.error(policies.message);
      return {} as Policy;
    default:
      return {} as Policy;
  }
}

// Given permissions JSON object, should return true if policies are valid
// else show an error return false
// we need to ckeck if MMPermission match with mattermostPermissions
//
// (unknown) => boolean
function isValidPermissions(permissions: unknown): boolean {
  const result = mattermostPermissionsDecoder.decode(permissions);
  switch (result.type) {
    case "OK":
      return true;
    case "ERR":
      console.error(
        result.message,
        ". MMPermission should match with mattermost Permissions, same keys and values"
      );
      return false;
  }
}

// Roles data
// ------------

// Given Mapping, MappingKey, MappingOptions, should return a list of MappingRole
//
// Mapping => MappingKey => MappingOptions => MappingRole[]
function getMappingRoles(
  mapping: Mapping,
  key: MappingKey,
  value: MappingOptions
): MappingRole[] {
  return mapping[key][value];
}

// Given Mapping, MappingKey, should get a part of Mapping
// and return a list of MappingValue

// Mapping => MappingKey => MappingValue[]
function mappingValueFromRoless(
  mapping: Mapping,
  key: MappingKey
): MappingValue {
  return mapping[key];
}

// Given MMPermission, RoleValue, should
// update permissios list with oermission value
// RoleValue permissions list should contain unique values
//
// MMPermission => Role => Role
function addPermissionToRoleValue(permission: MMPermission, role: Role): Role {
  return {
    ...role,
    permissions: [...new Set([...role.permissions, permission])],
  };
}

// Given MMPermission, RoleValue, should remove the permission
// from RoleValue permissions list
//
// MMPermission => RoleValue => RoleValue
function removePermissionToRoleValue(
  permission: MMPermission,
  role: Role
): Role {
  return {
    ...role,
    permissions: role.permissions.filter(
      (rolePermission) => rolePermission !== permission
    ),
  };
}

// Given list MappingRole, Roles, iterate over MappingRole comparing
// MappingRole.name with Roles keys, if equals add or remove permission
// based on shouldHave value
//
// MappingRole[] => Roles => Roles
function addOrRemovePermissions(
  mappingRoles: MappingRole[],
  role: Roles
): Roles {
  return mappingRoles.reduce((acc, mappingRole) => {
    const { roleName, permission, shouldHave } = mappingRole;
    const roleValue = acc[roleName];
    if (roleValue) {
      const newRoleValue = shouldHave
        ? addPermissionToRoleValue(permission, roleValue)
        : removePermissionToRoleValue(permission, roleValue);
      return { ...acc, [roleName]: newRoleValue };
    }
    return acc;
  }, role);
}

// Policy data
// ------------

// Given Policy, Mapping should getMappingRoles for each key and value
// return a list of MappingRole.
// If policy is empty, return an empty list
//
// Policy => Mapping => MappingRole[]
function getPolicyMappingRoles(
  policy: Policy,
  mapping: Mapping
): MappingRole[] {
  if (Object.keys(policy).length === 0) {
    return [];
  }

  return Object.entries(policy).flatMap(([key, value]) =>
    getMappingRoles(mapping, key as MappingKey, value as MappingOptions)
  );
}

// Should return Mapping, using MMPermission
//
// () => Mapping
function getMapping(): Mapping {
  return {
    enableTeamCreation: {
      true: [
        {
          roleName: "system_user",
          permission: MMPermission.CREATE_TEAM,
          shouldHave: true,
        },
      ],
      false: [
        {
          roleName: "system_user",
          permission: MMPermission.CREATE_TEAM,
          shouldHave: false,
        },
      ],
    },

    editOthersPosts: {
      true: [
        {
          roleName: "system_admin",
          permission: MMPermission.EDIT_OTHERS_POSTS,
          shouldHave: true,
        },
        {
          roleName: "team_admin",
          permission: MMPermission.EDIT_OTHERS_POSTS,
          shouldHave: true,
        },
      ],
      false: [
        {
          roleName: "team_admin",
          permission: MMPermission.EDIT_OTHERS_POSTS,
          shouldHave: false,
        },
        {
          roleName: "system_admin",
          permission: MMPermission.EDIT_OTHERS_POSTS,
          shouldHave: true,
        },
      ],
    },

    enableOnlyAdminIntegrations: {
      true: [
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_INCOMING_WEBHOOKS,
          shouldHave: false,
        },
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_OUTGOING_WEBHOOKS,
          shouldHave: false,
        },
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_SLASH_COMMANDS,
          shouldHave: false,
        },
        {
          roleName: "system_user",
          permission: MMPermission.MANAGE_OAUTH,
          shouldHave: false,
        },
      ],
      false: [
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_INCOMING_WEBHOOKS,
          shouldHave: true,
        },
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_OUTGOING_WEBHOOKS,
          shouldHave: true,
        },
        {
          roleName: "team_user",
          permission: MMPermission.MANAGE_SLASH_COMMANDS,
          shouldHave: true,
        },
        {
          roleName: "system_user",
          permission: MMPermission.MANAGE_OAUTH,
          shouldHave: true,
        },
      ],
    },
  };
}

// Should return default Roles
//
// () => Roles
function getDefaultRoles(): Roles {
  const role: Role = {
    id: "",
    name: "",
    display_name: "",
    description: "",
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    permissions: [],
    scheme_managed: false,
    built_in: false,
  };

  return {
    system_admin: role,
    system_user: role,
    team_admin: role,
    team_user: role,
  };
}

// Given Record<string. Role> should check if string matches MappingRoleName
// if matches, should add it to a new Roles
//
// Record<string, Role> => Roles
function getRoles(roles: Record<string, Role>): Roles {
  const mappingKeys: MappingRoleName[] = [
    "system_user",
    "system_admin",
    "team_admin",
    "team_user",
  ];

  return Object.entries(roles).reduce(
    (acc, [key, value]) => {
      if (mappingKeys.includes(key as MappingRoleName)) {
        return { ...acc, [key]: value };
      }
      return acc;
    },
    { ...getDefaultRoles() }
  );
}

// Mappings values from Role
// -------------------------

// Given MappingKey, Roles, should check if given roles
// fulfill the requirements for MappingRole.shouldHave
// if matches for "true" should return "true"
// if matches for "false" should return "false"
// if not matches should print a warning and return ""
//
// MappingKey => Roles => string
function mappingValueFromRoles(mappingKey: MappingKey, roles: Roles): string {
  const mappingRolesTrue = getMappingRoles(getMapping(), mappingKey, "true");
  const mappingRolesFalse = getMappingRoles(getMapping(), mappingKey, "false");

  let value = "";

  ["true", "false"].forEach((v) => {
    const mappingRoles = v === "true" ? mappingRolesTrue : mappingRolesFalse;

    mappingRoles.forEach((mappingRole) => {
      const { roleName, permission, shouldHave } = mappingRole;
      const role = roles[roleName];

      if (role) {
        const hasPermission = role.permissions.includes(permission);
        const cond1 = shouldHave && hasPermission;
        const cond2 = !shouldHave && !hasPermission;

        switch (true) {
          case cond1:
            value = "true";
            break;
          case cond2:
            value = "false";
            break;
        }
      }
    });
  });

  if (value === "") {
    console.warn(`Warning: Could not get value for ${mappingKey} from roles.`);
  }

  return value;
}

// Init
// -------

// Given unknown policies, unknown roles,
// ckeck that roles and policies are valid.
// should return a new Roles with the updated permissions
//
// unnown => unknown => unknown => Roles
function rolesFromMapping(
  policies: unknown = {},
  roles: Record<string, Role> = {}
): Roles {
  if (!isValidPermissions(MattermostPermissions)) {
    return getDefaultRoles();
  }

  const decodedPolicies = decodePolicies(policies);
  const checkedPolicies = checkPolicies(decodedPolicies);

  const mapping = getMapping();
  const mappingRoles = getPolicyMappingRoles(checkedPolicies, mapping);
  const filteredRoles = getRoles(roles);

  return addOrRemovePermissions(mappingRoles, filteredRoles);
}

// Tests
// -------
console.log(" ------------------ start ----------------------");
console.log(
  "rolesFromMapping -> ",
  rolesFromMapping(mockedPolicies, mockedRole).system_user.permissions
);
console.log(
  "mappingValueFromRoles ->",
  mappingValueFromRoles("enableTeamCreation", mockedRole)
);
console.log(" ------------------ end ----------------------");
