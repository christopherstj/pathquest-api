import Challenge from "./Challenge";

export default interface UserChallenge extends Challenge {
    is_favorited: boolean;
    is_public: boolean;
}
