import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkSphereMapper from '@kitware/vtk.js/Rendering/Core/SphereMapper';
import { throttle } from '@kitware/vtk.js/macro';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

const VTK_TO_TYPED_ARRAY = {
  vtkSignedCharArray: Int8Array,
  vtkUnsignedCharArray: Uint8Array,
  vtkShortArray: Int16Array,
  vtkUnsignedShortArray: Uint16Array,
  vtkIntArray: Int32Array,
  vtkUnsignedIntArray: Uint32Array,
  vtkTypeFloat32Array: Float32Array,
  vtkFloatArray: Float32Array,
  vtkDoubleArray: Float64Array,
  vtkTypeFloat64Array: Float64Array,
  // vtkLongArray: BigInt64Array,
  // vtkUnsignedLongArray: BigUint64Array,
};

const BBOX = Uint8Array.from([
  5,
  0,
  1,
  2,
  3,
  0, //
  5,
  4,
  5,
  6,
  7,
  4, //
  2,
  0,
  4, //
  2,
  1,
  5, //
  2,
  2,
  6, //
  2,
  3,
  7, //
]);

// function octreeToPolyData(origin, spacing, dimensions, octree) {
//   const points = [];
//   const [piMax, pjMax, pkMax] = dimensions;
//   const [ciMax, cjMax, ckMax] = [piMax - 1, pjMax - 1, pkMax - 1];

//   const quaterSpacing = spacing / 4;
//   const xyz = [0, 0, 0];
//   for (let k = 0; k < ckMax; k++) {
//     for (let j = 0; j < cjMax; j++) {
//       for (let i = 0; i < ciMax; i++) {
//         const cIdx = i + j * ciMax + k * ciMax * cjMax;
//         const v = octree[cIdx];
//         if (v) {
//           xyz[0] = origin[0] + (i + 0.5) * spacing;
//           xyz[1] = origin[1] + (j + 0.5) * spacing;
//           xyz[2] = origin[2] + (k + 0.5) * spacing;
//           // source.indexToWorld([i + 0.5, j + 0.5, k + 0.5], xyz);
//           if (v & 1) {
//             points.push(xyz[0] - quaterSpacing);
//             points.push(xyz[1] - quaterSpacing);
//             points.push(xyz[2] - quaterSpacing);
//           }
//           if (v & 2) {
//             points.push(xyz[0] + quaterSpacing);
//             points.push(xyz[1] - quaterSpacing);
//             points.push(xyz[2] - quaterSpacing);
//           }
//           if (v & 4) {
//             points.push(xyz[0] - quaterSpacing);
//             points.push(xyz[1] + quaterSpacing);
//             points.push(xyz[2] - quaterSpacing);
//           }
//           if (v & 8) {
//             points.push(xyz[0] + quaterSpacing);
//             points.push(xyz[1] + quaterSpacing);
//             points.push(xyz[2] - quaterSpacing);
//           }
//           if (v & 16) {
//             points.push(xyz[0] - quaterSpacing);
//             points.push(xyz[1] - quaterSpacing);
//             points.push(xyz[2] + quaterSpacing);
//           }
//           if (v & 32) {
//             points.push(xyz[0] + quaterSpacing);
//             points.push(xyz[1] - quaterSpacing);
//             points.push(xyz[2] + quaterSpacing);
//           }
//           if (v & 64) {
//             points.push(xyz[0] - quaterSpacing);
//             points.push(xyz[1] + quaterSpacing);
//             points.push(xyz[2] + quaterSpacing);
//           }
//           if (v & 128) {
//             points.push(xyz[0] + quaterSpacing);
//             points.push(xyz[1] + quaterSpacing);
//             points.push(xyz[2] + quaterSpacing);
//           }
//         }
//       }
//     }
//   }
//   const polydata = vtkPolyData.newInstance();
//   polydata.getPoints().setData(Float64Array.from(points), 3);
//   return polydata;
// }

class OctreeRepresentation {
  constructor(origin, spacing, dimensions, octree) {
    this.origin = origin;
    this.spacing = spacing;
    this.dimensions = dimensions;
    this.octree = octree;
    //
    this.polydata = vtkPolyData.newInstance();
    this.mapper = vtkSphereMapper.newInstance();
    this.mapper.setRadius(spacing / 4);
    this.actor = vtkActor.newInstance();
    this.actor.setMapper(this.mapper);
    this.mapper.setInputData(this.polydata);
    //
    this.update();
  }

  update() {
    const points = [];
    const [piMax, pjMax, pkMax] = this.dimensions;
    const [ciMax, cjMax, ckMax] = [piMax - 1, pjMax - 1, pkMax - 1];

    const quaterSpacing = this.spacing / 4;
    const xyz = [0, 0, 0];
    for (let k = 0; k < ckMax; k++) {
      for (let j = 0; j < cjMax; j++) {
        for (let i = 0; i < ciMax; i++) {
          const cIdx = i + j * ciMax + k * ciMax * cjMax;
          const v = this.octree[cIdx];
          if (v) {
            xyz[0] = this.origin[0] + (i + 0.5) * this.spacing;
            xyz[1] = this.origin[1] + (j + 0.5) * this.spacing;
            xyz[2] = this.origin[2] + (k + 0.5) * this.spacing;
            if (v & 1) {
              points.push(xyz[0] - quaterSpacing);
              points.push(xyz[1] - quaterSpacing);
              points.push(xyz[2] - quaterSpacing);
            }
            if (v & 2) {
              points.push(xyz[0] + quaterSpacing);
              points.push(xyz[1] - quaterSpacing);
              points.push(xyz[2] - quaterSpacing);
            }
            if (v & 4) {
              points.push(xyz[0] - quaterSpacing);
              points.push(xyz[1] + quaterSpacing);
              points.push(xyz[2] - quaterSpacing);
            }
            if (v & 8) {
              points.push(xyz[0] + quaterSpacing);
              points.push(xyz[1] + quaterSpacing);
              points.push(xyz[2] - quaterSpacing);
            }
            if (v & 16) {
              points.push(xyz[0] - quaterSpacing);
              points.push(xyz[1] - quaterSpacing);
              points.push(xyz[2] + quaterSpacing);
            }
            if (v & 32) {
              points.push(xyz[0] + quaterSpacing);
              points.push(xyz[1] - quaterSpacing);
              points.push(xyz[2] + quaterSpacing);
            }
            if (v & 64) {
              points.push(xyz[0] - quaterSpacing);
              points.push(xyz[1] + quaterSpacing);
              points.push(xyz[2] + quaterSpacing);
            }
            if (v & 128) {
              points.push(xyz[0] + quaterSpacing);
              points.push(xyz[1] + quaterSpacing);
              points.push(xyz[2] + quaterSpacing);
            }
          }
        }
      }
    }
    this.mapper.modified();
    this.polydata.getPoints().setData(Float64Array.from(points), 3);
    this.polydata.modified();
  }

  clearBounds(bounds) {
    const iMin = Math.floor((bounds[0] - this.origin[0]) / this.spacing);
    const iMax = Math.ceil((bounds[1] - this.origin[0]) / this.spacing);
    const jMin = Math.floor((bounds[2] - this.origin[1]) / this.spacing);
    const jMax = Math.ceil((bounds[3] - this.origin[1]) / this.spacing);
    const kMin = Math.floor((bounds[4] - this.origin[2]) / this.spacing);
    const kMax = Math.ceil((bounds[5] - this.origin[2]) / this.spacing);

    const ciMax = this.dimensions[0] - 1;
    const cjMax = this.dimensions[1] - 1;

    for (let k = kMin; k <= kMax; k++) {
      for (let j = jMin; j <= jMax; j++) {
        for (let i = iMin; i <= iMax; i++) {
          const cIdx = i + j * ciMax + k * ciMax * cjMax;
          this.octree[cIdx] = 0;
        }
      }
    }

    this.update();
  }
}

class PointCloudConnectivityCache {
  constructor() {
    this.cache = {};
  }

  getVerts(size) {
    let array = this.cache[size];
    if (!array) {
      array = new Uint32Array(size + 1);
      array[0] = size;
      for (let i = 0; i < size; i++) {
        array[i + 1] = i;
      }
      this.cache[size] = array;
    }
    return array;
  }
}

const VERTS_CACHE = new PointCloudConnectivityCache();

class ProgressGeometry {
  constructor(points) {
    const size = points.length / 3;
    this.polydata = vtkPolyData.newInstance();
    this.polydata.getPoints().setData(points, 3);
    this.polydata.getVerts().setData(VERTS_CACHE.getVerts(size));

    this.mapper = vtkMapper.newInstance();
    this.mapper.setInputData(this.polydata);

    this.actor = vtkActor.newInstance();
    this.actor.setMapper(this.mapper);
  }
}

export default {
  name: 'ProgressiveMesh',
  props: {
    port: {
      type: Number,
      default: 0,
    },
    uuid: {
      type: String,
    },
    skipOctree: {
      type: Boolean,
      default: false,
    },
  },
  mounted() {
    this.progressGeometry = [];
    this.realMesh = vtkPolyData.newInstance();
    this.throttleRender = throttle(this.view.render, 500);

    this.onMeshUpdate = async ([msg]) => {
      if (msg.uuid === this.uuid) {
        if (msg.type === 'metadata') {
          this.arrayConstructors = {
            points: VTK_TO_TYPED_ARRAY[msg.points_type],
            verts: VTK_TO_TYPED_ARRAY[msg.verts_type],
            lines: VTK_TO_TYPED_ARRAY[msg.lines_type],
            polys: VTK_TO_TYPED_ARRAY[msg.polys_type],
            strips: VTK_TO_TYPED_ARRAY[msg.strips_type],
          };
          this.points = new this.arrayConstructors.points(msg.points * 3);
          this.polys = new this.arrayConstructors.polys(msg.polys);
          this.bounds = msg.bounds;

          let idx = 0;
          // p0
          this.points[idx++] = this.bounds[0];
          this.points[idx++] = this.bounds[2];
          this.points[idx++] = this.bounds[4];
          // p1
          this.points[idx++] = this.bounds[1];
          this.points[idx++] = this.bounds[2];
          this.points[idx++] = this.bounds[4];
          // p2
          this.points[idx++] = this.bounds[1];
          this.points[idx++] = this.bounds[3];
          this.points[idx++] = this.bounds[4];
          // p3
          this.points[idx++] = this.bounds[0];
          this.points[idx++] = this.bounds[3];
          this.points[idx++] = this.bounds[4];

          // p4
          this.points[idx++] = this.bounds[0];
          this.points[idx++] = this.bounds[2];
          this.points[idx++] = this.bounds[5];
          // p5
          this.points[idx++] = this.bounds[1];
          this.points[idx++] = this.bounds[2];
          this.points[idx++] = this.bounds[5];
          // p6
          this.points[idx++] = this.bounds[1];
          this.points[idx++] = this.bounds[3];
          this.points[idx++] = this.bounds[5];
          // p7
          this.points[idx++] = this.bounds[0];
          this.points[idx++] = this.bounds[3];
          this.points[idx++] = this.bounds[5];

          while (idx < this.points.length) {
            this.points[idx++] = this.bounds[0];
            this.points[idx++] = this.bounds[2];
            this.points[idx++] = this.bounds[4];
          }

          this.realMesh.getPoints().setData(this.points, 3);
          this.realMesh.getLines().setData(BBOX);

          if (msg.camera) {
            this.view.style.setCenterOfRotation(msg.camera.focalPoint);
            this.view.activeCamera.set(msg.camera);
          }
          this.downstream.setInputData(this.realMesh);
          this.view.render();

          // Offsets
          this.pointOffset = 0;
          this.polyOffset = 0;
        } else if (msg.type === 'octree') {
          if (this.skipOctree) {
            return;
          }
          const arrayBuffer = await msg.octree.arrayBuffer();
          const octree = new Uint8Array(arrayBuffer);

          this.octreeRepresentation = new OctreeRepresentation(
            msg.origin,
            msg.spacing,
            msg.dimensions,
            octree
          );

          if (this.view) {
            this.view.renderer.addActor(this.octreeRepresentation.actor);
            this.view.render();
          }
        } else if (msg.type === 'xyz-chunk') {
          // Points
          const buffer = await msg.xyz.arrayBuffer();
          const array = new this.arrayConstructors.points(buffer);
          for (let i = 0; i < array.length; i++) {
            this.points[this.pointOffset++] = array[i];
          }

          // Polys
          const bufferPoly = await msg.polys.arrayBuffer();
          const arrayPoly = new this.arrayConstructors.polys(bufferPoly);
          for (let i = 0; i < arrayPoly.length; i++) {
            this.polys[this.polyOffset++] = arrayPoly[i];
          }

          this.polyOffset;

          const geoItem = new ProgressGeometry(array);
          this.progressGeometry.push(geoItem);
          this.view.renderer.addActor(geoItem.actor);

          // Make room for new points
          if (this.octreeRepresentation) {
            this.octreeRepresentation.clearBounds(geoItem.polydata.getBounds());
          }
          this.view.render();

          // this.representation.dataChanged();
        } else if (msg.type === 'connectivity') {
          const vertsBuffer = await msg.verts.arrayBuffer();
          const verts = new this.arrayConstructors.verts(vertsBuffer);
          this.realMesh.getVerts().setData(verts);

          const linesBuffer = await msg.lines.arrayBuffer();
          const lines = new this.arrayConstructors.lines(linesBuffer);
          this.realMesh.getLines().setData(lines);

          if (msg.polys) {
            const bufferPoly = await msg.polys.arrayBuffer();
            const arrayPoly = new this.arrayConstructors.polys(bufferPoly);
            for (let i = 0; i < arrayPoly.length; i++) {
              this.polys[this.polyOffset++] = arrayPoly[i];
            }
          }
          this.realMesh.getPolys().setData(this.polys);

          const stripsBuffer = await msg.strips.arrayBuffer();
          const strips = new this.arrayConstructors.strips(stripsBuffer);
          this.realMesh.getStrips().setData(strips);
          //
          this.realMesh.getPoints().modified();
          this.realMesh.modified();
          this.downstream.modified();
          //
          if (this.octreeRepresentation) {
            this.view.renderer.removeActor(this.octreeRepresentation.actor);
          }
          while (this.progressGeometry.length) {
            const item = this.progressGeometry.pop();
            this.view.renderer.removeActor(item.actor);
          }

          this.view.render();
        }
      }
    };

    if (this.trame) {
      this.wslinkSubscription = this.trame.client
        .getConnection()
        .getSession()
        .subscribe('trame.progressive.topic.mesh', this.onMeshUpdate);

      this.trame.trigger(`update_progressive_mesh_${this.uuid}`);
    }
  },
  beforeDestroy() {
    if (this.wslinkSubscription) {
      if (this.trame) {
        this.trame.client
          .getConnection()
          .getSession()
          .unsubscribe(this.wslinkSubscription);
        this.wslinkSubscription = null;
      }
    }

    this.realMesh.delete();
    this.realMesh = null;
  },
  methods: {},
  inject: ['trame', 'view', 'representation', 'downstream'],
};
