import { afterEach, describe, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "@/lib/providers/places/google";
import { isValidPlacePhotoName } from "@/lib/providers/places/photos";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidPlacePhotoName", () => {
  it.each([
    { name: "places/ChIJ_abc-123/photos/AbC_123-x", expected: true },
    { name: "places/x/photos/y/media", expected: false },
    { name: "../x", expected: false },
    { name: "", expected: false },
    { name: "places/a b/photos/c", expected: false },
  ])("$name returns $expected", ({ name, expected }) => {
    expect(isValidPlacePhotoName(name)).toBe(expected);
  });
});

describe("GooglePlacesProvider.getPlace photos", () => {
  it("requests and maps only the first photo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "places/place-1",
          displayName: { text: "Example Place" },
          formattedAddress: "1 Example Street",
          location: { latitude: 43.65, longitude: -79.38 },
          types: ["restaurant"],
          photos: [
            {
              name: "places/place-1/photos/photo-1",
              authorAttributions: [
                {
                  displayName: "Photo Author",
                  uri: "https://example.test/author",
                },
              ],
              googleMapsUri: "https://maps.google.test/place",
            },
            { name: "places/place-1/photos/photo-2" },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GooglePlacesProvider("test-key");
    const place = await provider.getPlace("place-1", "summary");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/place-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-FieldMask": expect.stringContaining("photos"),
        }),
      }),
    );
    expect(place?.photo).toEqual({
      name: "places/place-1/photos/photo-1",
      authorName: "Photo Author",
      authorUri: "https://example.test/author",
      googleMapsUri: "https://maps.google.test/place",
    });
  });

  it("leaves photo undefined when Google has no photos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "places/place-1",
            displayName: { text: "Example Place" },
            formattedAddress: "1 Example Street",
            location: { latitude: 43.65, longitude: -79.38 },
            types: ["restaurant"],
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new GooglePlacesProvider("test-key");
    const place = await provider.getPlace("place-1", "summary");

    expect(place?.photo).toBeUndefined();
  });
});
