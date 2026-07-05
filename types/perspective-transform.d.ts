declare module "perspective-transform" {
    export default function PerspT(
        src: number[],
        dst: number[]
    ): {
        transform: (x: number, y: number) => [number, number];
        transformInverse: (x: number, y: number) => [number, number];
        coeffs: number[];
    };
}
