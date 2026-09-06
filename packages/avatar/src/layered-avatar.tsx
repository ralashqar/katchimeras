import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { centeredLayerStyle, type LayerPresentation } from './layout';
export type LayeredAvatarProps = {
bodySource: ImageSource | number; faceSource: ImageSource | number; hat?: ImageSource | number | null; heldAccessory?: ImageSource | number | null;
bodyPresentation: LayerPresentation; hatPresentation: LayerPresentation; heldPresentation?: LayerPresentation;
faceScale?:number; faceTransitionDuration?:number; allowDownscaling?:boolean;showFace?:boolean;transition?:number;priority?:'low'|'normal'|'high';onError?:()=>void;onLoad?:()=>void;style?:StyleProp<ViewStyle>;
};
export function LayeredAvatar({bodySource,faceSource,hat,heldAccessory,bodyPresentation,hatPresentation,heldPresentation,faceScale=0.92,faceTransitionDuration=0,allowDownscaling=true,showFace=true,transition=0,priority='normal',onError,onLoad,style}: LayeredAvatarProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {/* Keep each native image view stable while its source changes. A recyclingKey
          deliberately clears expo-image to blank, which causes a visible hole while
          the newly selected customization is decoding. Without it, expo-image keeps
          the displayed layer until the replacement is ready, then applies transition. */}
      <Image
        allowDownscaling={allowDownscaling}
        cachePolicy="memory-disk"
        contentFit="contain"
        onError={onError}
        onLoad={onLoad}
        priority={priority}
        source={bodySource}
        style={centeredLayerStyle(bodyPresentation.scale, bodyPresentation.offsetX, bodyPresentation.offsetY)}
        transition={transition}
      />
      {showFace ? (
        <Image
          allowDownscaling={allowDownscaling}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={priority}
          source={faceSource}
          style={centeredLayerStyle(faceScale)}
          transition={faceTransitionDuration}
        />
      ) : null}
      {hat ? (
        <Image
          allowDownscaling={allowDownscaling}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={priority}
          source={hat}
          style={centeredLayerStyle(hatPresentation.scale, hatPresentation.offsetX, hatPresentation.offsetY)}
          transition={transition}
        />
      ) : null}
      {heldAccessory ? (
        <Image
          allowDownscaling={allowDownscaling}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={priority}
          source={heldAccessory}
          style={centeredLayerStyle(
            heldPresentation?.scale ?? 1,
            heldPresentation?.offsetX ?? 0,
            heldPresentation?.offsetY ?? 0,
          )}
          transition={transition}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
});
