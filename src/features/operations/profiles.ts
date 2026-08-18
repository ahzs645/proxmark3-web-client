export type OperationProfileName = "fast" | "recommended" | "thorough";

export interface Type2OperationOptions {
  profile: OperationProfileName;
  checkDevice: boolean;
  requireKnownProfile: boolean;
  checkStaticLock: boolean;
  checkDynamicLock: boolean;
  checkAuth0: boolean;
  backup: boolean;
  targetStability: boolean;
  twoPhase: boolean;
  precommitVerify: boolean;
  finalVerify: boolean;
  protectedVerify: boolean;
}

export function type2Options(profile: OperationProfileName): Type2OperationOptions {
  if (profile === "fast") {
    return {
      profile,
      checkDevice: false,
      requireKnownProfile: true,
      checkStaticLock: true,
      checkDynamicLock: true,
      checkAuth0: true,
      backup: false,
      targetStability: false,
      twoPhase: false,
      precommitVerify: false,
      finalVerify: false,
      protectedVerify: false,
    };
  }
  if (profile === "thorough") {
    return {
      profile,
      checkDevice: true,
      requireKnownProfile: true,
      checkStaticLock: true,
      checkDynamicLock: true,
      checkAuth0: true,
      backup: true,
      targetStability: true,
      twoPhase: true,
      precommitVerify: true,
      finalVerify: true,
      protectedVerify: true,
    };
  }
  return {
    profile: "recommended",
    checkDevice: true,
    requireKnownProfile: true,
    checkStaticLock: true,
    checkDynamicLock: true,
    checkAuth0: true,
    backup: true,
    targetStability: true,
    twoPhase: true,
    precommitVerify: false,
    finalVerify: true,
    protectedVerify: true,
  };
}
