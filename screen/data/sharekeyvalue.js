import React from 'react';
import {
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-root-toast';
import RNPickerSelect from 'react-native-picker-select';
import HTMLView from 'react-native-htmlview';
import Icon from 'react-native-vector-icons/Ionicons';
const StyleSheet = require('../../PlatformStyleSheet');
const KevaButton = require('../../common/KevaButton');
const KevaColors = require('../../common/KevaColors');
import { THIN_BORDER, SCREEN_WIDTH } from '../../util';
import { HDSegwitP2SHWallet, } from '../../class';
import { htmlStyles } from './showkeyvalue';
import {
  BlueNavigationStyle,
  BlueLoading,
  BlueBigCheckmark,
} from '../../BlueComponents';
const loc = require('../../loc');
let BlueApp = require('../../BlueApp');
let BlueElectrum = require('../../BlueElectrum');
import { FALLBACK_DATA_PER_BYTE_FEE } from '../../models/networkTransactionFees';
import { TransitionPresets } from 'react-navigation-stack';

import { connect } from 'react-redux'
import { shareKeyValue } from '../../class/keva-ops';
import StepModal from "../../common/StepModalWizard";
import Biometric from '../../class/biometrics';

class ShareKeyValue extends React.Component {

  constructor() {
    super();
    this.state = {
      loaded: false,
      changes: false,
      saving: false,
      value: '',
      showKeyValueModal: false,
      createTransactionErr: null,
    };
  }

  static navigationOptions = ({ navigation }) => ({
    ...BlueNavigationStyle(),
    title: '',
    tabBarVisible: false,
    headerRight: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-end' }}
        onPress={navigation.state.params.onPress}
      >
        <Text style={{ color: '#FFF', fontSize: 16, borderRadius: 20, backgroundColor: KevaColors.actionText, paddingVertical: 4, paddingHorizontal: 15 }}>{loc.general.share}</Text>
      </TouchableOpacity>
    ),
    headerLeft: () => (
      <TouchableOpacity
        style={{ marginHorizontal: 16, minWidth: 150, justifyContent: 'center', alignItems: 'flex-start' }}
        onPress={() => navigation.goBack()}
      >
        <Text style={{ color: KevaColors.actionText, fontSize: 16 }}>{loc.general.cancel}</Text>
      </TouchableOpacity>
    ),
    ...TransitionPresets.ModalTransition,
  });

  async componentDidMount() {
    const { shareTxid, origKey, origValue } = this.props.navigation.state.params;
    this.setState({
      shareTxid, origKey, origValue
    });
    this.props.navigation.setParams({
      onPress: this.onSave
    });
    this.isBiometricUseCapableAndEnabled = await Biometric.isBiometricUseCapableAndEnabled();
  }

  onSave = async () => {
    const { value } = this.state;
    const { namespaceList } = this.props;

    if (value.length == 0) {
      Toast.show('Write something to reply');
      return;
    }
    const wallets = BlueApp.getWallets();
    if (wallets.length == 0) {
      Toast.show("You don't have wallet");
      return;
    }

    const namespaces = namespaceList.namespaces;
    const defaultNamespaceId = namespaces[Object.keys(namespaces)[0]].id;

    this.setState({
      showKeyValueModal: true,
      currentPage: 0,
      showSkip: true,
      broadcastErr: null,
      isBroadcasting: false,
      fee: 0,
      createTransactionErr: null,
      currentPage: 0,
      namespaceId: this.state.namespaceId || defaultNamespaceId,
    });
  }

  KeyValueCreationFinish = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationCancel = () => {
    return this.setState({ showKeyValueModal: false });
  }

  KeyValueCreationNext = () => {
    return this.setState({
      currentPage: this.state.currentPage + 1
    });
  }

  getShareKeyValueModal = () => {
    const { namespaceList } = this.props;
    const { shareTxid, rootAddress } = this.props.navigation.state.params;
    if (!this.state.showKeyValueModal) {
      return null;
    }

    const namespaces = namespaceList.namespaces;
    const items = Object.keys(namespaces).map(ns => ({ label: namespaces[ns].displayName, value: namespaces[ns].id }));
    let selectNamespacePage = (
      <View style={styles.modalNS}>
        <Text style={[styles.modalText, { textAlign: 'center', marginBottom: 20, color: KevaColors.darkText }]}>{"Choose a namespace"}</Text>
        <RNPickerSelect
          value={this.state.namespaceId}
          useNativeAndroidPickerStyle={false}
          style={{
            inputAndroid: styles.inputAndroid,
            inputIOS: styles.inputIOS,
          }}
          onValueChange={(namespaceId) => this.setState({ namespaceId })}
          items={items}
          Icon={() => <Icon name="ios-arrow-down" size={24} color={KevaColors.actionText} style={{ padding: 12 }} />}
        />
        {/* <Text style={[styles.modalFee, {textAlign: 'center', marginTop: 10}]}>{wallet.getBalance()/100000000 + ' KVA'}</Text> */}
        <KevaButton
          type='secondary'
          style={{ margin: 10, marginTop: 40 }}
          caption={'Next'}
          onPress={async () => {
            try {
              const { namespaceId, value } = this.state;
              const shortCode = namespaceList.namespaces[namespaceId].shortCode;
              if (!shortCode) {
                throw new Error('Namespace not confirmed yet');
              }
              const walletId = namespaceList.namespaces[namespaceId].walletId;
              const wallets = BlueApp.getWallets();
              const wallet = wallets.find(w => w.getID() == walletId);
              if (!wallet) {
                throw new Error('Wallet not found');
              }
              // Make sure it is not single address wallet.
              if (wallet.type != HDSegwitP2SHWallet.type) {
                return alert(loc.namespaces.multiaddress_wallet);
              }
              this.setState({ showNSCreationModal: true, currentPage: 1 });
              const { tx, fee, cost } = await shareKeyValue(wallet, FALLBACK_DATA_PER_BYTE_FEE, namespaceId, shortCode, value, rootAddress, shareTxid);
              let feeKVA = (fee + cost) / 100000000;
              this.setState({ showNSCreationModal: true, currentPage: 2, fee: feeKVA });
              this.namespaceTx = tx;
            } catch (err) {
              console.warn(err);
              this.setState({ createTransactionErr: loc.namespaces.namespace_creation_err + ' [' + err.message + ']' });
            }
          }}
        />
      </View>
    );

    let createNSPage = (
      <View style={styles.modalNS}>
        {
          this.state.createTransactionErr ?
            <>
              <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
              <Text style={styles.modalErr}>{this.state.createTransactionErr}</Text>
              <KevaButton
                type='secondary'
                style={{ margin: 10, marginTop: 30 }}
                caption={'Cancel'}
                onPress={async () => {
                  this.setState({ showKeyValueModal: false, createTransactionErr: null });
                }}
              />
            </>
            :
            <>
              <Text style={[styles.modalText, { alignSelf: 'center', color: KevaColors.darkText }]}>{loc.namespaces.creating_tx}</Text>
              <Text style={styles.waitText}>{loc.namespaces.please_wait}</Text>
              <BlueLoading style={{ paddingTop: 30 }} />
            </>
        }
      </View>
    );

    let confirmPage = (
      <View style={styles.modalNS}>
        <Text style={styles.modalText}>{"Transaction fee:  "}
          <Text style={styles.modalFee}>{this.state.fee + ' KVA'}</Text>
        </Text>
        <KevaButton
          type='secondary'
          style={{ margin: 10, marginTop: 40 }}
          caption={'Confirm'}
          onPress={async () => {
            this.setState({ currentPage: 3, isBroadcasting: true });
            try {
              await BlueElectrum.ping();
              await BlueElectrum.waitTillConnected();
              if (this.isBiometricUseCapableAndEnabled) {
                if (!(await Biometric.unlockWithBiometrics())) {
                  this.setState({ isBroadcasting: false });
                  return;
                }
              }
              let result = await BlueElectrum.broadcast(this.namespaceTx);
              if (result.code) {
                // Error.
                return this.setState({
                  isBroadcasting: false,
                  broadcastErr: result.message,
                });
              }
              await BlueApp.saveToDisk();
              this.setState({ isBroadcasting: false, showSkip: false });
            } catch (err) {
              this.setState({ isBroadcasting: false });
              console.warn(err);
            }
          }}
        />
      </View>
    );

    let broadcastPage;
    if (this.state.isBroadcasting) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={styles.modalText}>{"Broadcasting Transaction ..."}</Text>
          <BlueLoading style={{ paddingTop: 30 }} />
        </View>
      );
    } else if (this.state.broadcastErr) {
      broadcastPage = (
        <View style={styles.modalNS}>
          <Text style={[styles.modalText, { color: KevaColors.errColor, fontWeight: 'bold' }]}>{"Error"}</Text>
          <Text style={styles.modalErr}>{this.state.broadcastErr}</Text>
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Cancel'}
            onPress={async () => {
              this.setState({ showKeyValueModal: false });
            }}
          />
        </View>
      );
    } else {
      broadcastPage = (
        <View style={styles.modalNS}>
          <BlueBigCheckmark style={{ marginHorizontal: 50 }} />
          <KevaButton
            type='secondary'
            style={{ margin: 10, marginTop: 30 }}
            caption={'Done'}
            onPress={async () => {
              this.setState({
                showKeyValueModal: false,
                nsName: '',
              });
              Toast.show(loc.general.share_sent, {
                position: Toast.positions.TOP,
                backgroundColor: "#53DD6C",
              });
              this.props.navigation.goBack();
            }}
          />
        </View>
      );
    }

    return (
      <View>
        <StepModal
          showNext={false}
          showSkip={this.state.showSkip}
          currentPage={this.state.currentPage}
          stepComponents={[selectNamespacePage, createNSPage, confirmPage, broadcastPage]}
          onFinish={this.KeyValueCreationFinish}
          onNext={this.KeyValueCreationNext}
          onCancel={this.KeyValueCreationCancel} />
      </View>
    );
  }

  renderNode = (node, index) => {
    if (!node.name && node.type == 'text') {
      return (<Text style={{fontSize: 16, color: KevaColors.darkText, lineHeight: 25}}>{node.data}</Text>);
    } else if (node.name == 'img') {
      const a = node.attribs;
      const width = Dimensions.get('window').width * 0.9;
      const height = (a.height && a.width) ? (a.height / a.width) * width : width;
      return (<Image style={{ width, height, alignSelf: 'center'}} source={{ uri: a.src }} key={index} resizeMode="contain"/>);
    }
  }

  getContent = () => {
    const origValue = this.state.origValue;
    const content = (
      <View style={styles.origContainer}>
        <HTMLView value={`${origValue}`}
          addLineBreaks={false}
          stylesheet={htmlStyles}
          nodeComponentProps={{ selectable: true }}
          renderNode={this.renderNode}
          style={{borderWidth: THIN_BORDER, borderColor: KevaColors.cellBorder, borderRadius: 12, padding: 10,}}
        />
      </View>
    );
    return content;
  }

  render() {
    let { navigation, dispatch } = this.props;
    return (
      <ScrollView style={styles.container}>
        {this.getShareKeyValueModal()}
        <View style={styles.inputValue}>
          <TextInput
            multiline={true}
            noBorder
            autoCorrect={true}
            value={this.state.value}
            underlineColorAndroid='rgba(0,0,0,0)'
            style={{ fontSize: 15, flex: 1, textAlignVertical: 'top' }}
            clearButtonMode="while-editing"
            onChangeText={value => { this.setState({ value }) }}
          />
        </View>
        { this.getContent() }
      </ScrollView>
    );
  }

}

function mapStateToProps(state) {
  return {
    namespaceList: state.namespaceList,
  }
}

export default ShareKeyValueScreen = connect(mapStateToProps)(ShareKeyValue);

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KevaColors.background,
  },
  inputKey: {
    height: 45,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
  },
  inputValue: {
    height: 100,
    marginTop: 10,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.cellBorder,
    backgroundColor: '#fff',
    paddingHorizontal: 10
  },
  modalNS: {
    height: 300,
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  modalText: {
    fontSize: 18,
    color: KevaColors.lightText,
  },
  waitText: {
    fontSize: 16,
    color: KevaColors.lightText,
    paddingTop: 10,
    alignSelf: 'center',
  },
  modalFee: {
    fontSize: 18,
    color: KevaColors.statusColor,
  },
  modalErr: {
    fontSize: 16,
    marginTop: 20,
  },
  inputAndroid: {
    width: SCREEN_WIDTH * 0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  inputIOS: {
    width: SCREEN_WIDTH * 0.8,
    color: KevaColors.lightText,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: THIN_BORDER,
    borderColor: KevaColors.lightText,
    borderRadius: 4
  },
  origContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  quote: {
    borderLeftWidth: 4,
    borderColor: KevaColors.cellBorder,
    width: 0,
    marginLeft: 10,
    marginRight: 7,
    height: '100%',
  }
});