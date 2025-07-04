import Challenge from "./Challenge";

export default interface UserChallenge extends Challenge {
    isFavorited: boolean;
    isPublic: boolean;
}
