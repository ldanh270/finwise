import {
  bottomNavigationContentStyle,
  bottomNavigationItemStyle,
} from "./bottom-navigation-layout";

describe("bottom navigation layout", () => {
  it("allows all primary tabs to share the viewport without horizontal overflow", () => {
    expect(bottomNavigationContentStyle).toMatchObject({
      width: "100%",
      flexDirection: "row",
    });
    expect(bottomNavigationItemStyle).toMatchObject({
      flex: 1,
      minWidth: 0,
    });
  });
});
